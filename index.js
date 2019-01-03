const mainConfig = require('./config');
const Telegraf = require('telegraf');
const loki = require('lokijs');
const express = require('express');
const bot = new Telegraf(mainConfig.botKey);
let app = express();
let db = new loki('messages.json');
let messagesdb = db.addCollection('messagesdb');

function addDb(message, date) {
	return messagesdb.insert({message: message, date: new Date(), vipChannelRead: false, freeChannelRead: false})
}

bot.use((ctx, next) => {

	const start = new Date()

	// If channel post comes from main channel, add it to database
	if(ctx.updateType == 'channel_post' && ctx.update.channel_post.chat.id == mainConfig.mainChannel ) {
		addDb(ctx.update.channel_post.text, ctx.update.channel_post.date)
		ctx.telegram.sendMessage(mainConfig.premierChannel, ctx.update.channel_post.text)
	}	

	app.get('/cron', (req, res)=>{
		let cronStart = new Date()
		let vipChannelPause=mainConfig.vipChannelPause*60*1000;
		let freeChannelPause=mainConfig.freeChannelPause*60*1000;
		let vips = messagesdb.find({vipChannelRead: false});
		let frees = messagesdb.find({freeChannelRead: false, vipChannelRead: true});

		vips.forEach(v=>{
			let date = new Date();
			if((date - new Date(v.date)) > vipChannelPause) {
				console.log('sending message to vip:', v.message)
				ctx.telegram.sendMessage(mainConfig.vipChannel, v.message)
				messagesdb.findAndUpdate({'$loki': v['$loki']}, function(v){
					return v.vipChannelRead = true;
				})
			}
		})

		frees.forEach(v=>{
			let date = new Date();
			if((date - new Date(v.date)) > freeChannelPause) {
				console.log('sending message to free:', v.message)
				ctx.telegram.sendMessage(mainConfig.freeChannel, v.message)
				messagesdb.findAndRemove({'$loki': v['$loki'], vipChannelRead: true})
			}
		})

		let cronMs = new Date() - cronStart
		console.log('processed cron in %sms', cronMs)
		res.sendStatus(200)
	})

	return next().then(() => {
		const ms = new Date() - start
		console.log('Signal saved to DB in %sms', ms)
	})
})

app.listen(3000, function(){
	console.log('listening')
	bot.startPolling()
})
