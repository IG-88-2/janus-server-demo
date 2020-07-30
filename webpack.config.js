const path = require(`path`);
const webpack = require(`webpack`);
const CleanWebpackPlugin = require(`clean-webpack-plugin`);
const CopyWebpackPlugin = require(`copy-webpack-plugin`);



module.exports = {

	context: __dirname,

	mode : `development`,

	entry : {
		'main' : `./main.ts`
	},
	
	output : {
		filename : `[name].js`,
		path : path.resolve(__dirname, `dist`)
	},

	resolve : {
		extensions : [ `.ts`, `.tsx`, `.js` ]
	},

	module : {
		rules : [
			{
				test : /\.(ts|tsx)?$/,
				exclude : /(node_modules)/,
				loader : `ts-loader`
			},
			{
				test : /\.js$/,
				exclude : /(node_modules|bower_components)/,
				loader : `babel-loader`
			}
		]
	},

	devtool : `source-map`,

	target : `node`,

	plugins : [],
	
	externals: {
		puppeteer: 'require("puppeteer")',
	},
	
	node : {
		__dirname : false,
		__filename : false
	}
};
