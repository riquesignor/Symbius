// O google-services.json não fica no Git. No build da EAS ele chega como
// variável de ambiente do tipo arquivo (GOOGLE_SERVICES_JSON, com o caminho
// do arquivo); localmente usa o arquivo da raiz. Veja google-services.json.example.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
});
