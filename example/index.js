
/**
 * Example implementation of oled-ssh1106 display driver module on a Raspberry
 * Pi Zero with the WaveShare 1.3 inch OLED HAT...
 * https://www.waveshare.com/wiki/1.3inch_OLED_HAT
 *
 * Utilizes the 4 wire SPI configuration to communicate with the ssh1106 controller.
 *
 * Some display driver settings are specific to the WaveShare 1.3 inch OLED device
 * and will vary for other OLED devices.
 *
 * OLED display is 128 x 64
 *   displayColumns: 128,
 *   displayRows: 64,
 *
 * SSH1106 RAM is 132 x 64, which requires an offset for the 128 x 64 OLED
 *   columnOffset: 2,
 *
 * WaveShare device is designed for the following multiplex ratio and common pad configuration
 *  multiplexRatio: 0x3F,
 *  commonPadConfig: 0x12
 */

// using the rpio module for GPIO and SPI interface
const RPIO = require('rpio');

// GPIO numbers for ssh1106 functions
const PIN_RESET = 25;
const PIN_DATA_COMMAND = 24;

// use GPIOxx numbering and /dev/mem for i2c/PWM/SPI (requires running with sudo, i.e. sudo node index.js)
RPIO.init({ mapping: 'gpio' });
RPIO.init({ gpiomem: false });

// initialize SPI interface
RPIO.spiBegin();
RPIO.spiChipSelect(0);
RPIO.spiSetClockDivider(256);
RPIO.spiSetDataMode(0);

// configure function pins
RPIO.open(PIN_RESET, RPIO.OUTPUT, RPIO.HIGH);
RPIO.open(PIN_DATA_COMMAND, RPIO.OUTPUT, RPIO.LOW);

// create and configure sh1106 display driver
const SH1106 = require('../lib/index.js'); // example uses relative path for ssh1106 module
const Display = SH1106({
  sendCommand: transferArray,  // must provide a method to transfer byte array in command mode
  sendData: transferDataArray, // must provide a method to transfer byte array in data mode
  hardwareReset: resetDevice,  // must provide a method to reset the hardware
  displayColumns: 128,
  displayRows: 64,
  columnOffset: 2,
  multiplexRatio: 0x3F,
  commonPadConfig: 0x12
});

// load test fonts and convert to image map
const FiveSevenFont = require('./oled-font-5x7');
const DotMonocoFont = require('./dotmonoco-font');
const FSFontImageMap = Display.fontToImageMap(FiveSevenFont);
const DMFontImageMap = Display.fontToImageMap(DotMonocoFont);

// initialize the display
Display.init()
.then(() => {
  // start in upper left corner
  Display.setCursor(0, 0);
  // use 5x7 font to draw string with newline to jump cursor to next line
  Display.drawString('Hello world!\n', FSFontImageMap);
  // use Dot Monoco font to draw string with wrap turned on
  Display.drawString('Hello world!', DMFontImageMap, true);
  // update the display with the content we have drawn
  return Display.updateDisplay();
})
.then(() => {
  console.log('Complete');
  process.exit(0);
})
.catch(err => {
  console.log('ERR', err.message, err.stack);
  process.exit(1);
});


// switch to data command mode then transfer data over SPI
async function transferDataArray(data) {
  RPIO.write(PIN_DATA_COMMAND, 1);
  await transferArray(data);
  RPIO.write(PIN_DATA_COMMAND, 0);
}

// transfer data over SPI
async function transferArray(data) {
  let rxBuff = new Buffer(data.length);
  RPIO.spiTransfer(Buffer.from(data), rxBuff, data.length);
  return rxBuff;
}

// toggle reset pin on the SH1106 device
async function resetDevice() {
  await setReset(RPIO.HIGH, 500)
  await setReset(RPIO.LOW, 500);
  await setReset(RPIO.HIGH, 3000);
}

// set reset pin value with optional delay
function setReset(v, d) {
	return new Promise((resolve, reject) => {
		RPIO.write(PIN_RESET, v);
		setTimeout(() => { resolve(); }, d);
	});
}
