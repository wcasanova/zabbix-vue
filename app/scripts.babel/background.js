'use strict';

const Zabbix = require('zabbix-promise');
var settings = null;
var interval;
var triggerResults = {};


function initalize() {
	settings = JSON.parse(localStorage.getItem('ZabbixServers')) || null;
	try {
		interval = settings['global']['interval'];
	} catch (err) {
		interval = 60;
	}
	console.log('Got settings: ' + JSON.stringify(settings));
}

function getServerTriggers(server, user, pass, groups, callback) {
	let zResults = {};
	let requestObject = {
		'output': 'extend',
		'expandDescription': 1,
		'selectHosts': 'extend',
		'filter': {
			'value': 1,
			'status': 0
		},
		'sortfield': 'priority',
		'sortorder': 'DESC'
	}

	const zabbix = new Zabbix(
		server + '/api_jsonrpc.php',
		user,
		pass
	);
	if (groups.length > 0) {
		requestObject.groupids = groups
	}

	zabbix.login()
	.then(() => zabbix.request('trigger.get', requestObject))
	.then((value) => {
		callback(value)
	}).finally(() => zabbix.logout())
}

function getTriggers(){
	//console.log('getTriggers running with settings: ' + JSON.stringify(settings));
	if (!settings || 0 === settings.length) {
		triggerResults = {};
		console.log('No servers defined.');
	} else {
		for (var i = 0; i < settings['servers'].length; i++) {
			let server = settings['servers'][i].alias;
			let serverURL = settings['servers'][i].url;
			let user = settings['servers'][i].user
			let pass = settings['servers'][i].pass
			let groups = settings['servers'][i].hostGroups;
			console.log('Found server: ' + server);
			getServerTriggers(serverURL, user, pass, groups, function(results) {
				triggerResults[server] = results;
			})
		}
		console.log('Got trigger result: ' + JSON.stringify(triggerResults));
	}
}

function scheduleCheckServers() {
	console.log('Running scheduleCheckServers as scheduled');
	getTriggers(function() {});

	setTimeout(function(){ scheduleCheckServers(); },1000*interval);
}

function getActiveTriggersTable(callback) {
	let popupHeaders = [
		{'text': 'System','value': 'system'},
		{'text': 'Description','value': 'description'},
		{'text': 'Priority','value': 'priority'},
		{'text': 'Age','value': 'age'}
	]

	//console.log('getActiveTriggersTable activated. Current triggerResults: ' + JSON.stringify(triggerResults))
	if (Object.keys(triggerResults).length === 0 && triggerResults.constructor === Object) {
		console.log('No current triggers or servers');
	} else {
		let bigTable = {};
		bigTable['servers'] = []
		bigTable['headers'] = popupHeaders
		let servers = Object.keys(triggerResults)
		for (var i = 0; i < servers.length; i++) {
			let serverObject = {};
			let triggerTable = [];
			let server = servers[i];
			console.log('Generating trigger table for server: ' + JSON.stringify(server));
			for (var t = 0; t < triggerResults[server].length; t++) {
				let system = triggerResults[server][t]['hosts'][0]['host']
				var description = triggerResults[server][t]['description']
				var priority = Number(triggerResults[server][t]['priority'])
				var age = Number(triggerResults[server][t]['lastchange'])
				var triggerid = triggerResults[server][t]['triggerid']
				triggerTable.push({'system': system,
								'description': description,
								'priority': priority,
								'age': age,
								'triggerid': triggerid})
			}
			console.log('TriggerTable: ' + JSON.stringify(triggerTable));
			serverObject[server] = triggerTable;
			// Add search string for server
			serverObject[server]['search'] = '';
			console.log('serverObject is: ' + JSON.stringify(serverObject));
			bigTable['servers'].push(serverObject);
		}
		console.log('Complete table: ' + JSON.stringify(bigTable));
		callback(bigTable);
	}
	callback(null);
}

// Run our script as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
	initalize();
    scheduleCheckServers();
});

// Activate messaging to popup.js
function handleMessage(request, sender, sendResponse) {
    switch (request.method) {
    case 'refreshTriggers':
		getActiveTriggersTable(function(results) {
            sendResponse(results);
        });
		break;
	case 'reinitalize':
		initalize();
	}
}
var browser = browser || chrome;
browser.runtime.onMessage.addListener(handleMessage);
