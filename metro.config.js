const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ── Fix: Firebase JS SDK (modular) ainda não é 100% compatível com a
// resolução de módulos via "package.json:exports", habilitada por padrão
// desde o Expo SDK 53 / React Native 0.79. Sem isso, getFirestore(app)
// falha com "Service firestore is not available".
// Ref: https://github.com/expo/expo/discussions/36551
config.resolver.unstable_enablePackageExports = false;

module.exports = config;