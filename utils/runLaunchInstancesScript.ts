import { pause } from './pause';
import { spawnProcess } from './spawnProcess';

export const runLaunchInstancesScript = (p: number, options) => {
	
    const source = spawnProcess("launchInstances.js");

	source.stdout.setEncoding('utf8');

	source.stderr.setEncoding('utf8');

	source.stdout.on('data', function(data) {
		console.log('stdout: ' + data);
	});
	
	source.stderr.on('data', function(data) {
		console.log('stderr: ' + data);
	});
    
    const promise = new Promise((resolve) => {
		
		source.on("message", (data) => {
			//TODO exec docker not calling callback - verify launched
			pause(p)
			.then(() => {
				source.send({
					type:"exit"
				});
				resolve(data.load);
			});
			
		});
		
	});

    source.send({
		type:"launch", 
		load: options
	});

    return promise;
}