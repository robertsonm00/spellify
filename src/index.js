import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import reportWebVitals from './reportWebVitals';

// Dev-only debug surface so the OCR pipeline can be exercised from the
// browser console without going through onboarding. Stripped in prod.
if (process.env.NODE_ENV === 'development') {
  Promise.all([
    import('./utils/ocrExtract'),
    import('./utils/imagePreprocess'),
    import('./utils/wordValidation'),
    import('tesseract.js'),
  ]).then(([ocr, prep, val, tess]) => {
    window.__spellifyDebug = { ...ocr, ...prep, ...val, tesseract: tess };
    console.info('[spellify] debug helpers attached at window.__spellifyDebug');
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
