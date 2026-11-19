const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../../src/admin/useAdminShellTheme.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// Render the actual shell theme hook with the screen fixture's native palette.
function adminShellThemeFixture(mocks, screen) {
  const mod = new Module(filename, module);
  const nativePlatform = mocks['react-native']?.Platform;
  const platform = screen.endsWith('.ios.tsx') ? { OS: 'ios' }
    : screen.endsWith('.android.tsx') ? { OS: 'android' } : nativePlatform ?? { OS: 'android' };
  const dependencies = {
    'react-native': { Platform: platform },
    '../components/useBaseTheme': mocks['../components/useBaseTheme'],
    './AdminShellContext': { useOptionalAdminShell: () => null, ...mocks['./AdminShellContext'] },
  };
  mod.require = id => dependencies[id];
  mod._compile(source, filename);
  return mod.exports;
}

module.exports = { adminShellThemeFixture };
