import { Janus } from 'janus-gateway-node';
import { v1 as uuidv1 } from 'uuid';
import { exec } from 'child_process';
const pause = (n:number) => new Promise((resolve) => setTimeout(() => resolve(), n));
const path = require(`path`);
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream(__dirname + '/test.log', { flags : 'w' });
const transformError = (error: Object | string) => !error ?  `Unknown error` : typeof error === "string" ? error : util.inspect(error, {showHidden: false, depth: null});
const https = require('https');
var pem = require('pem');
//const options = { key: fs.readFileSync("certs/lxcie.com.key"), cert: fs.readFileSync("certs/STAR_lxcie_com.crt") };
//const options = { cert: fs.readFileSync('./cert/cert.pem'), key: fs.readFileSync('./cert/key.pem') };
//const server = https.createServer(options);




let janus = null;

let enable = true;

const logger = {
	enable: () => {

        enable = true;
    
    },
    disable: () => {
    
        enable = false;
    
    },
	info: (message) => {

		if (enable) {
			console.log("\x1b[32m", `[test info] ${message}`);
			logFile.write(util.format(message) + '\n');
		}

	},
	browser: (...args) => {

		if (enable) {
			if (args) {
				const message = args.join(' ');
				console.log("\x1b[33m", `[test browser] ${message}`);
				if (message.includes("error")) {
					logFile.write(util.format(message) + '\n');
				}
			}
		}

	},
	error: (message) => {
		
		if (enable) {
			if (typeof message==="string") {
				console.log("\x1b[31m", `[test error] ${message}`);
				logFile.write(util.format(message) + '\n');
			} else {
				try {
					const string = transformError(message);
					console.log("\x1b[31m", `[test error] ${string}`);
					logFile.write(util.format(string) + '\n');
				} catch(error) {}
			}
		}

	},
	json: (object) => {

		if (enable) {
			const string = JSON.stringify(object, null, 2);
			console.log("\x1b[37m", `[test json] ${string}`);
			logFile.write(util.format(string) + '\n');
		}

	}
};



const generateInstances = (amount:number) => {

	const instances = [];

	const start_ws_port = 8188;

	const start_admin_ws_port = 7188;

	for(let i = 0; i < amount; i++) {
		instances.push({
			id : uuidv1(),
			admin_key : uuidv1(),
			server_name : `instance_${i}`,
			log_prefix : `instance_${i}:`,
			docker_ip : `127.0.0.${1 + i}`, //"127.0.0.1", 
			ws_port : start_ws_port + i,
			admin_ws_port : start_admin_ws_port + i,
			stun_server : "stun.voip.eutelia.it",
			nat_1_1_mapping : "3.121.126.200", //"127.0.0.1", //"3.121.126.200",
			stun_port : 3478,
			debug_level : 5 //6
		});
	}
	
	return instances;

};



const launchContainers = (image, instances) => {

	logger.info(`launching ${instances.length} containers`);

	logger.json(instances);

	const step = 101;

	let udpStart = 20000;

	let udpEnd = udpStart + step - 1;

	for(let i = 0; i < instances.length; i++) {
		const {
			id,
			admin_key,
			server_name,
			ws_port,
			log_prefix,
			admin_ws_port,
			stun_server, 
			stun_port,
			docker_ip,
			debug_level,
			nat_1_1_mapping
		} = instances[i];
		
		const args = [
			[ "ID", id ],
			[ "ADMIN_KEY", admin_key ],
			[ "SERVER_NAME", server_name ],
			[ "WS_PORT", ws_port ],
			[ "ADMIN_WS_PORT", admin_ws_port ],
			[ "LOG_PREFIX", log_prefix ],
			[ "DOCKER_IP", docker_ip ],
			[ "DEBUG_LEVEL", debug_level ],
			[ "NAT_1_1_MAPPING", nat_1_1_mapping],
			[ "RTP_PORT_RANGE", `${udpStart}-${udpEnd}` ],
			[ "STUN_SERVER", stun_server ],
			[ "STUN_PORT", stun_port ]
		];
		
		let command = `docker run -i --cap-add=NET_ADMIN --name ${server_name} `;
		//--publish-all=true
		//-P
		//--network=host
		//-p 127.0.0.1:20000-40000:20000-40000
		//command += `-p 127.0.0.1:${udpStart}-${udpEnd}:${udpStart}-${udpEnd}/udp `;
		command += `-p ${udpStart}-${udpEnd}:${udpStart}-${udpEnd}/udp `; //`-p ${docker_ip}:${udpStart}-${udpEnd}:${udpStart}-${udpEnd}/udp `;
		command += `-p ${ws_port}:${ws_port} `;
		command += `-p ${admin_ws_port}:${admin_ws_port} `;
		command += `${args.map(([name,value]) => `-e ${name}="${value}"`).join(' ')} `;
		command += `${image}`;
		
		logger.info(`launching container ${i}...${command}`);

		exec(
			command,
			{
				maxBuffer: 1024 * 1024 * 1024
			},
			(error, stdout, stderr) => {
				
				logger.info(`container ${server_name} terminated`);

				if (error) {
					if (error.message) {
						logger.error(error.message);
					} else {
						logger.error(error);
					}
				}

			}
		);

		udpStart += step;
		udpEnd += step;
	}

};




const terminateContainers = async () => {

	let command = null;
	
	if (process.platform==='linux') {
		command = `sudo docker rm $(sudo docker ps -a -q)`; //docker stop
	} else {
		command = `FOR /F %A IN ('docker ps -q') DO docker rm -f %~A`; //docker stop
	}
	
	try {

		const result = await exec(
			command
		);

	} catch(error) {}

};



const instancesToConfigurations = (instances) => {

	const data = instances.map(({
		admin_key,
		server_name,
		ws_port,
		docker_ip,
		admin_ws_port,
		log_prefix,
		stun_server, 
		stun_port,
		id,
		debug_level
	}) => {
		return {
			protocol: `ws`,
			address: docker_ip,
			port: ws_port,
			adminPort: admin_ws_port,
			adminKey: admin_key,
			server_name
		};
	});

	return data;

};



const retrieveContext = () => {

	try {

		const contextPath = path.resolve('context.json');

		const file = fs.readFileSync(contextPath, 'utf-8');

		const context = JSON.parse(file);

		logger.info('context loaded');

		logger.json(context);

		return context;

	} catch(error) {

		logger.error(error);

		return {};

	}

};



const updateContext = async (rooms) => {

	try {
		
		const contextPath = path.resolve('context.json');

		const file = JSON.stringify(rooms);

		logger.info('update context');

		logger.json(rooms);

		const fsp = fs.promises;

		await fsp.writeFile(contextPath, file, 'utf8');
		
	} catch(error) {

		logger.error(error);
		
	}

	return rooms;

}



const termiante = async () => {

	await janus.terminate();

	await terminateContainers();

}



const main = async (server) => {
	
	const instances = generateInstances(2);
	
	const name = `herbert1947/janus-gateway-videoroom`;

	launchContainers(name, instances);

	const configs = instancesToConfigurations(instances);

	await pause(3000);
	
	janus = new Janus({
		getId: () => uuidv1(),
		instances: configs,
		retrieveContext, 
		updateContext,
		logger,
		webSocketOptions: {
			//host: '3.121.126.200',
			//host: '127.0.0.1', 
			server,
			port: 443, //8080,
			backlog: 10,
			clientTracking: false,
			perMessageDeflate: false,
			maxPayload: 10000
		},
		onConnected : () => {
			
			logger.info(`janus - connected`);
			
		},
		onDisconnected : () => {
			
			logger.info(`janus - disconnected`);
			
		},
		onError : (error) => {
			
			logger.error(error);

		}
	});
	
	//server.listen(443);

	await janus.initialize();
	
	const result = await janus.createRoom({
		load: {
			description: 'default room'
		}
	});

	logger.json(result);
	
}

pem.createCertificate({ days: 1, selfSigned: true }, function (err, keys) {
	if (err) {
	  throw err
	}
	const server = https.createServer({ key: keys.clientKey, cert: keys.certificate }/*, function (req, res) {
	
		console.log('server started', keys);

	}*/); //.listen(443)

	main(server);

})


