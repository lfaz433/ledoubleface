const fs = require('fs');
let content = fs.readFileSync('src/app/App.tsx', 'utf8');
content = content.replace('export default function App() {', 'import { ErrorBoundary } from "./components/ErrorBoundary";\n\nexport default function App() {');
content = content.replace('const handleUrlRouting = () => {', 'const AppContent = () => {');
content = content.replace('export default function App() {', 'function AppCore() {');
content = content.replace(/export default function AppCore\(\) \{/, 'function AppCore() {');

let wrapper = `
export default function App() {
  return (
    <ErrorBoundary>
      <AppCore />
    </ErrorBoundary>
  );
}
`;

content = content + wrapper;
fs.writeFileSync('src/app/App.tsx', content);
