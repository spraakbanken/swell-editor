const webpack = require("webpack");
const path = require("path");
const ClosureCompilerPlugin = require('webpack-closure-compiler')
const plugins = [
   new webpack.LoaderOptionsPlugin({
     debug: true
   })
]
if (process.env.NODE_ENV === 'production') {
    plugins.push(
        new ClosureCompilerPlugin({
            compiler: {
                language_in: 'ECMASCRIPT6',
                language_out: 'ECMASCRIPT5',
                compilation_level: 'SIMPLE',
                isolation_mode: 'IIFE',
                process_common_js_modules: true,
                assume_function_wrapper: 'true'
            },
            concurrency: 3,
        })
    );
}


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
            }
          ]
    }
};
