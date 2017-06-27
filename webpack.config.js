const webpack = require("webpack");
const path = require("path");

module.exports = {
    entry: [
        "react-hot-loader/patch",
        "./src/index.tsx",
    ],
    output: {
        path: path.join(__dirname, 'dist'),
        filename: "bundle.js",
        publicPath: "/static/",
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
    },

    /*
    plugins: [
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin(),
    ],

    devServer: {
        hot: true
    }
    */

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loaders: [
                    // "react-hot-loader/webpack",
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
                use: [ 'style-loader', 'css-loader' ]
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
                loader: 'url-loader?limit=10000&mimetype=application/octet-stream'
            },
            {
                test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'file-loader'
            },
            {
                test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'url-loader?limit=10000&mimetype=image/svg+xml'
            },
        ]
    },

    externals: {
        "codemirror": "CodeMirror",
    }
};
