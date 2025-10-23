const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === 'development';
    
    return {
        entry: {
            popup: './src/popup/index.tsx',
            content: './src/content/content.ts',
            background: './src/background/background.ts',
            welcome: './src/welcome/welcome.ts'
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].js',
            clean: true
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js']
        },
        // Disable eval in development mode for browser extensions
        devtool: isDevelopment ? 'inline-source-map' : 'source-map',
        optimization: {
            minimize: !isDevelopment
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './src/popup/popup.html',
                filename: 'popup.html',
                chunks: ['popup']
            }),
            new HtmlWebpackPlugin({
                template: './src/welcome/welcome.html',
                filename: 'welcome.html',
                chunks: ['welcome']
            }),
            new CopyPlugin({
                patterns: [
                    { from: 'public/manifest.json', to: 'manifest.json' },
                    { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
                    { from: 'src/content/content.css', to: 'content.css' },
                    { from: 'src/welcome/welcome.css', to: 'welcome.css' }
                ]
            })
        ]
    };
};