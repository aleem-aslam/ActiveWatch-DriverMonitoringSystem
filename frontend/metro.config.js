const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver:{
    assetExts:[
      'tflite',
      'png',
      'jpg',
    ],
  },
};

module.exports = mergeConfig(
 getDefaultConfig(__dirname),
 config
);