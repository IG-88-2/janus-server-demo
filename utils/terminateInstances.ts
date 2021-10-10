import child_process = require('child_process');

export const terminateInstances = () => {
	
	const command = process.platform==='linux' ? `docker rm $(docker ps -a -q)` : `FOR /F %A IN ('docker ps -q') DO docker rm -f %~A`;
	
	try {

		const result = child_process.execSync(
			command
		);

	} catch(error) {

		console.error(error);

	}
	
}