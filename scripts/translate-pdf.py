"""BabelDOC layout worker. Model requests travel over stdio to PaperLens.

BabelDOC is installed separately under its AGPL-3.0 license. No upstream code
is copied here, and model credentials never enter this worker's protocol.
"""
import asyncio
import json
import os
import queue
import shutil
import sys
import threading
from pathlib import Path

_protocol = sys.stdout
sys.stdout = sys.stderr  # Third-party diagnostics must not corrupt the protocol.
_lock = threading.Lock()


def emit(event):
    with _lock:
        _protocol.write(json.dumps(event, ensure_ascii=False) + '\n')
        _protocol.flush()


def main():
    import pymupdf
    from babeldoc.docvision.doclayout import DocLayoutModel
    from babeldoc.format.pdf import high_level as pdf_engine
    from babeldoc.format.pdf.high_level import async_translate
    from babeldoc.format.pdf.translation_config import TranslationConfig, WatermarkOutputMode
    from babeldoc.translator.translator import BaseTranslator, set_translate_rate_limiter

    if os.name == 'nt':
        # The whole engine already runs in a disposable process controlled by
        # PaperLens. Avoid nested Windows processes for tiny font/save tasks:
        # their startup can hit BabelDOC's 60/120-second fallbacks repeatedly.
        from babeldoc.format.pdf.document_il.backend.pdf_creater import PDFCreater

        class WorkerPDFCreater(PDFCreater):
            @staticmethod
            def subset_fonts_in_subprocess(pdf, translation_config, tag):
                translation_config.raise_if_cancelled()
                pdf.subset_fonts(fallback=False)
                return pdf

            @staticmethod
            def save_pdf_with_timeout(pdf, output_path, translation_config, **options):
                translation_config.raise_if_cancelled()
                pdf.save(output_path, garbage=options.get('garbage', 1),
                         deflate=options.get('deflate', True), clean=False,
                         deflate_fonts=options.get('deflate_fonts', True))
                return False  # Saved without optional content-stream cleaning.

        pdf_engine.PDFCreater = WorkerPDFCreater

    source, destination, lang_in, lang_out = sys.argv[1:]
    destination = Path(destination)
    with pymupdf.open(source) as original:
        if original.needs_pass:
            raise ValueError('PDF 已加密，请解除密码后重新导入')
        if not original.page_count or sum(len(page.get_text().strip()) for page in original) < 40:
            raise ValueError('这份 PDF 没有足够的可提取文字，请先进行 OCR 再翻译')
        boxes = [tuple(page.mediabox) for page in original]

    class PaperLensTranslator(BaseTranslator):
        name = 'paperlens'

        def __init__(self):
            super().__init__(lang_in, lang_out, ignore_cache=True)
            self.count = 0
            self.pending = {}
            self.pending_lock = threading.Lock()
            threading.Thread(target=self.receive, daemon=True).start()

        def receive(self):
            buffer = b''
            try:
                while chunk := os.read(sys.stdin.fileno(), 65536):
                    buffer += chunk
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        response = json.loads(line.decode('utf-8'))
                        with self.pending_lock:
                            waiter = self.pending.get(response.get('id'))
                        if waiter is not None:
                            waiter.put_nowait(response)
            finally:
                with self.pending_lock:
                    for waiter in self.pending.values():
                        if waiter.empty():
                            waiter.put_nowait({'error':'翻译服务已断开'})

        def do_llm_translate(self, text, rate_limit_params=None):
            raise NotImplementedError

        def do_translate(self, text, rate_limit_params=None):
            waiter = queue.Queue(maxsize=1)
            with self.pending_lock:
                self.count += 1
                request_id = self.count
                self.pending[request_id] = waiter
            try:
                emit({'type':'translate', 'id':request_id, 'text':text})
                response = waiter.get(timeout=900)
                if response.get('id') != request_id or response.get('error'):
                    raise RuntimeError(response.get('error', '翻译响应编号无效'))
                return response['text']
            finally:
                with self.pending_lock:
                    self.pending.pop(request_id, None)

    emit({'type':'progress', 'progress':3, 'label':'正在准备版面模型与字体，首次运行需要下载…'})
    set_translate_rate_limiter(30)
    config = TranslationConfig(
        translator=PaperLensTranslator(), input_file=source,
        lang_in=lang_in, lang_out=lang_out,
        doc_layout_model=DocLayoutModel.load_available(),
        output_dir=destination, working_dir=destination / 'work',
        no_dual=False, no_mono=False, qps=30, pool_max_workers=8,
        watermark_output_mode=WatermarkOutputMode.NoWatermark,
        auto_extract_glossary=False, save_auto_extracted_glossary=False,
        disable_rich_text_translate=True, skip_scanned_detection=False,
        enable_graphic_element_process=True, only_include_translated_page=False,
    )

    async def run():
        result = None
        async for event in async_translate(config):
            if event['type'] == 'error':
                raise RuntimeError(str(event.get('error', '排版引擎未完成')))
            if event['type'].startswith('progress'):
                emit({'type':'progress', 'progress':min(96, max(4, event.get('overall_progress', 4))), 'stage':event.get('stage', '')})
            if event['type'] == 'finish':
                result = event['translate_result']
                # Stop on the terminal event. BabelDOC 0.6.4's callback iterator
                # can otherwise wait on an empty queue after finishing.
                break
        if result is None:
            raise RuntimeError('排版引擎没有生成译文')
        mono = result.no_watermark_mono_pdf_path or result.mono_pdf_path
        dual = result.no_watermark_dual_pdf_path or result.dual_pdf_path
        if not mono or not dual:
            raise RuntimeError('译文 PDF 未完整生成')
        with pymupdf.open(mono) as translated:
            if translated.page_count != len(boxes) or any(tuple(page.mediabox) != box for page, box in zip(translated, boxes)):
                raise RuntimeError('译文页数或页面尺寸与原文不一致')
        for generated, name in [(mono,'translated.pdf'),(dual,'bilingual.pdf')]:
            target = destination / name
            shutil.copyfile(generated, target.with_suffix('.part'))
            target.with_suffix('.part').replace(target)
        emit({'type':'complete', 'pages':len(boxes)})

    asyncio.run(run())


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        emit({'type':'error', 'error':str(error)[:500]})
        sys.exit(1)
