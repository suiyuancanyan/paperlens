# Contributing to PaperLens

欢迎提交 Issue、功能建议和 Pull Request。You can write in Chinese or English.

## Report a problem

Include your operating system, Node.js version, browser or desktop version,
steps to reproduce, and what you expected to happen. For model errors, include
the provider and model name and the error shown in the app.

Use a public or synthetic document when sharing an example. Remove API keys,
login information and private paper contents from screenshots and logs.

## Develop

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4173>. Before submitting a change, run:

```sh
npm test
npm run build
```

Keep changes focused on one problem or feature. Describe the user-visible
behavior and the checks you ran. For interface changes, include a screenshot.
For document import changes, include a small synthetic or freely reusable
fixture where possible. Tests run locally and do not require a live AI account.

## Ideas we would like help with

- More robust figure boundaries and captions across paper layouts.
- OCR and navigation for scanned documents.
- Word equations and native chart handling.
- Reading and accessibility improvements in Chinese and English.
- Desktop packaging, launch reliability and library migration.

Contributions to the project code are provided under its MIT License. Keep
third-party licenses and figure attribution when reusing existing material.
