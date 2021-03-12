const path = require("path");
const webpack = require("webpack");
const CopyFilePlugin = require("copy-webpack-plugin");
const WriteFilePlugin = require("write-file-webpack-plugin");

const baseConfig = {
  mode: "development",

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
        include: [path.resolve(__dirname, "src")],
        exclude: [/node_modules/],
      },
      {
        test: /\.node$/,
        loader: "node-loader",
      },
    ],
  },

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },

  devServer: {
    open: true,
    host: "localhost",
  },
};

const nodeScriptConfig = {
  target: "node",

  entry: {
    // unlock: path.resolve(__dirname, "src", "unlock.ts"),
    convert: path.resolve(__dirname, "src", "convertpdf.ts"),
    main: path.resolve(__dirname, "src", "main.ts"),
  },

  plugins: [
    new webpack.ProgressPlugin(),
    new CopyFilePlugin({
      patterns: [
        {
          context: "src",
          from: "playwright.js",
          to: path.resolve(__dirname, "dist"),
          force: true,
        },
      ],
    }),
    new WriteFilePlugin(),
  ],

  mode: baseConfig.mode,
  module: baseConfig.module,
  resolve: baseConfig.resolve,
  devServer: baseConfig.devServer,
};

const webScriptConfig = {
  target: "web",

  entry: {
    webScript: path.resolve(__dirname, "src", "webScript.ts"),
  },

  plugins: [new webpack.ProgressPlugin()],

  // output: {
  //   library: "webScript",
  //   libraryTarget: "commonjs",
  // },

  mode: baseConfig.mode,
  module: baseConfig.module,
  resolve: baseConfig.resolve,
  devServer: baseConfig.devServer,
};

module.exports = [nodeScriptConfig, webScriptConfig];
