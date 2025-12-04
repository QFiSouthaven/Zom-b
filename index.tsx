/**
 * @file index.tsx
 * @description Application Entry Point.
 * 
 * This file handles the mounting of the React application into the DOM.
 * It uses React 18+ `createRoot` API for concurrent features.
 * 
 * Dependencies:
 * - React
 * - ReactDOM
 * - App (Main Component)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);