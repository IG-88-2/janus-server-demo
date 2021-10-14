import child_process = require('child_process');

export const terminateInstances = () => {
	//docker rm $(docker ps -a -q)
	const command = process.platform==='linux' ? `sudo docker rm -f $(sudo docker ps -a -q)` : `FOR /F %A IN ('docker ps -q') DO docker rm -f %~A`;
	
	try {

		const result = child_process.execSync(
			command
		);

	} catch(error) {

		console.error(error);

	}
	
}