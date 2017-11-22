const webpack = require("webpack");
const ClosureCompilerPlugin = require('webpack-closure-compiler');
const path = require("path");
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const production = 'NODE_ENV' in process.env && process.env.NODE_ENV === 'production'
const plugins = [
  new webpack.DefinePlugin({
    Debug: JSON.stringify(!production)
  }),
  new webpack.LoaderOptionsPlugin({
    debug: !production
  }),
  new webpack.optimize.ModuleConcatenationPlugin()
]
if (!production) {
  plugins.push(new webpack.NamedModulesPlugin())
}
if (production) {
  plugins.push(new ClosureCompilerPlugin({
    compiler: {
      language_in: 'ECMASCRIPT6',
      language_out: 'ECMASCRIPT3',
      compilation_level: 'SIMPLE'
    },
    concurrency: 3
  }))
}

const HTML = require("html-webpack-plugin")
plugins.push(
  new HTML({
    hash: true,
    template: './src/index.html',
    filename: './index.html',
  }),
)

module.exports = {
    entry: [
        "./src/index.ts",
    ],
    output: {
        filename: "bundle.js",
    },
    plugins: plugins,

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".js"]
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loaders: [
                    "awesome-typescript-loader"
                ],
                exclude: path.resolve(__dirname, 'node_modules'),
                include: path.resolve(__dirname, "src"),
            },
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader' ],
                include: [path.resolve(__dirname, "node_modules"),
                          path.resolve(__dirname, "src")]
            },
            // http://andrejgajdos.com/setting-up-webpack-for-es6-react-sass-and-bootstrap/
            // the url-loader uses DataUrls.
            // the file-loader emits files.
            {
                test: /\.(woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'url-loader?limit=10000&mimetype=application/font-woff'
            },
            {
                test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'url-loader?limit=10000&mimetype=application/octet-stream',
                include: [__dirname]
            },
          ]
    }
};
