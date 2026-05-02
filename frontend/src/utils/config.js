import configData from '../config.json';

const getBackendUrl = () => {
  if (configData.BACKEND_URL.includes('localhost')) {
    return `http://${window.location.hostname}:4000`;
  }
  return configData.BACKEND_URL;
};

const getMockoonUrl = () => {
  return configData.MOCKOON_URL;
};

export const CONFIG = {
  ...configData,
  BACKEND_URL: getBackendUrl(),
  MOCKOON_URL: getMockoonUrl()
};
