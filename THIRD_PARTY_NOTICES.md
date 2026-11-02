# Third-party notices

PaperLens source code is provided under the MIT License. Third-party libraries,
fonts, rendering assets and paper figures retain their original licenses and
copyright notices.

## Software

Runtime and build dependencies are listed in `package.json` and pinned in
`package-lock.json`. Their license files are available in the corresponding
installed packages. PDF.js character maps, fonts and WebAssembly assets are
copied from `pdfjs-dist` during installation with their bundled license files.
The desktop packaging script includes a `THIRD-PARTY-NOTICES.txt` file in its
runtime output. Electron distributions also carry their own notices.

## Reading sample

The three PNGs under `public/samples/` reproduce Figure 1 and the two parts of
Figure 2 from:

Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones,
Aidan N. Gomez, Łukasz Kaiser and Illia Polosukhin.
*Attention Is All You Need*. NeurIPS 2017.
<https://arxiv.org/abs/1706.03762>

The figures are credited in the application and used as an attributed academic
reading sample. They are **excluded from the MIT grant for PaperLens code**;
their original rights and reuse terms apply. Screenshots showing those figures
carry the same attribution. PaperLens does not distribute the complete paper
or users' imported documents in this source repository.

The [paper's permission notice](https://arxiv.org/html/1706.03762v7) grants
attributed reproduction of figures and tables for journalistic or scholarly works.
