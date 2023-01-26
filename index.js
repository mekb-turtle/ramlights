const memUsedColour = [ 245, 69, 198 ];
const memAvailColour = [ 0, 0, 0 ];
const lightIndexMem = 0;
const lightCountMem = 10;
const lightReverseMem = true;

const swapUsedColour = [ 41, 183, 249 ];
const swapAvailColour = [ 0, 0, 0 ];
const lightIndexSwap = 1;
const lightCountSwap = 10;
const lightReverseSwap = true;

const sdkClient = {
	host: "localhost",
	port: 6742,
	name: "RAM lights"
};

const { spawn } = require("child_process");
const { OpenRGBClient, OpenRGBDevice } = require("openrgb");

function colour(e) {
	return e.map(f => ({ red: f[0], green: f[1], blue: f[2] }));
}
function lerpN(a, b, t) {
	return (b-a)*t+a;
}
function lerp(a, b, t) {
	return a.map((_, i) => lerpN(a[i], b[i], t));
}
function round(a) {
	return a.map(i => Math.floor(i));
}
function percArr(perc, len) {
	let arr = new Array(len).fill(0);
	let n = perc * len;
	let nF = Math.floor(n);
	let nC = Math.ceil(n);
	for (let i = 0; i < nF; ++i) {
		arr[i] = 1;
	}
	if (nC > nF) {
		arr[nF] = n - nF;
	}
	return arr;
}
function parseFree(str) {
	let lines = str.split("\n");
	let mem = lines[1].split(/ +/g);
	let swap = lines[2].split(/ +/g);
	let memUsed = +mem[2];
	let memTotal = +mem[1];
	let swapUsed = +swap[2];
	let swapTotal = +swap[1];
	let memPerc = memTotal > 0 ? memUsed / memTotal : 0;
	let swapPerc = swapTotal > 0 ? swapUsed / swapTotal : 0;
	return { mem: memPerc, swap: swapPerc };
}
function run(bin, cmdline) {
	var proc = spawn(bin, cmdline);
	let buffers = [];
	proc.stdout.on("data", b => buffers.push(b));
	proc.stdin.end();
	return new Promise((resolve, reject) => {
		proc.once("error", reject);
		proc.once("exit", (c) => {
			if (c > 0) reject("exited with code", c);
			resolve(Buffer.concat(buffers));
		});
	});
}
async function setLight(client, index, count, reverse, perc, availColour, usedColour) {
	if (index == null) return;
	const device = await client.getDeviceController(index);
	console.log(device.colors.length);
	let colours = percArr(perc, count);
	console.log(`Setting ${device.name} (#${index}) to`, colours);
	colours = colours.map(e => round(lerp(availColour, usedColour, e)));
	if (reverse) colours = colours.reverse();
	await client.updateLeds(index, colour(colours));
}
(async()=>{
	let out = await run("/bin/free", [ ]);
	let perc = parseFree(out.toString());
	const client = new OpenRGBClient(sdkClient);
	try {
		await client.connect();
	} catch (err) {
		if (err.code == "ECONNREFUSED") {
			console.log(`Try starting the SDK server with 'openrgb --server --server-port ${sdkClient.port}'`);
		}
		throw err;
	}
	await setLight(client, lightIndexMem,  lightCountMem,  lightReverseMem,  perc.mem,  memAvailColour,  memUsedColour);
	await setLight(client, lightIndexSwap, lightCountSwap, lightReverseSwap, perc.swap, swapAvailColour, swapUsedColour);
	await client.disconnect();
})();
