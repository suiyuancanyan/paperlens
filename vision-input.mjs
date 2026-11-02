export function decodeVisionImages(images = []) {
  if (!Array.isArray(images) || images.length > 6) throw new Error('单次最多读取 6 张图片');
  let total = 0;
  return images.map(image => {
    const match = typeof image?.dataUrl === 'string' && image.dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) throw new Error('图片格式无效，请使用 PNG 或 JPEG');
    const buffer = Buffer.from(match[2],'base64'); total += buffer.length;
    if (buffer.length > 5_000_000 || total > 12_000_000) throw new Error('图片过大，请缩小后重试');
    const valid = match[1] === 'png' ? buffer.length > 24 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : buffer.length > 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!valid) throw new Error('图片文件内容无效');
    return { buffer, extension:match[1] === 'png' ? 'png' : 'jpg', dataUrl:`data:image/${match[1]};base64,${buffer.toString('base64')}` };
  });
}
