// Keep the installed app's push identity in app.json; build ownership may differ.
module.exports = ({ config }) => {
  const owner = process.env.FOCALPOINT_EAS_OWNER;
  const projectId = process.env.FOCALPOINT_EAS_PROJECT_ID;
  if (!owner && !projectId) return config;
  if (!owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId || '')) {
    throw new Error('Set both FOCALPOINT_EAS_OWNER and a valid FOCALPOINT_EAS_PROJECT_ID.');
  }
  return {
    ...config,
    owner,
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
  };
};
