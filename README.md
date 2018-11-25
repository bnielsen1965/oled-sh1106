# SH1106 OLED Display Driver

Provides methods to control the SH1106 OLED display driver.

Draws heavily on [oled-js](https://github.com/noopkat/oled-js).

This driver module provides methods specific to displaying content and controlling
an OLED display connected to an SH1106 controller. A variety of communication
interfaces are available on the SH1106 so the oled-sh1106 driver module expects
that methods will be provided in the configuration settings for your communication
method. Examples are provided for one possible SPI based implementation.


## Configuration

Pass a configuration object when creating an instance of the SH1106 display module.

```javascript
const SH1106 = require('oled-sh1106'); // example uses relative path for ssh1106 module
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
```

### sendCommand

(required) A user provided async function to send an array of commands to the device.

Example async user method that uses the rpio module to transfer an array of data
over a SPI interface...
```javascript
// transfer data over SPI
async function transferArray(data) {
  let rxBuff = new Buffer(data.length);
  RPIO.spiTransfer(Buffer.from(data), rxBuff, data.length);
  return rxBuff;
}
```

### sendData

(required) A user provided async function to send data array to the device.

Example async user method that uses the rpio module to set the data command pin
before calling the previous example data transfer method...
```javascript
// switch to data command mode then transfer data over SPI
async function transferDataArray(data) {
  RPIO.write(PIN_DATA_COMMAND, 1);
  await transferArray(data);
  RPIO.write(PIN_DATA_COMMAND, 0);
}
```


### hardwareReset

(required) A user provided async function to reset the hardware.

Example async user method that uses the rpio module to set the hardware reset pin...
```javascript
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
```


### displayColumns

(required) the number of columns or width of the OLED display.


### displayRows

(required) The number for rows or height of the OLED display.


### columnOffset

(optional) Column offset in RAM, utilized when RAM is wider than the display.


### multiplexRatio

(recommended) The display device multiplex ratio setting, related to display height.


### commonPadConfig

(recommended) The display device common pad configuration setting, related to
display column wiring.


### lineSpacing

(optional) Space between lines when drawing strings, default is 1 row.


### letterSpacing

(optional) Space between characters when drawing characters, default is 1 column.


## Methods

The object returned by the oled-ssh1106 module will include methods that can be
used in an application to control the OLED device...

> NOTE: The drawing methods will draw content in the display module buffer, not
in the device RAM. After drawing content in the display module buffer it is
necessary to call one of the display module methods that will send the buffer or
updates to the display device RAM.


### init()

The init() method is used to initialize the OLED device. It will call the user's
hardware reset method to reset the hardware, send the SSH1106 initialization
command sequence to the device, and send the current buffer contents to the OLED
display RAM to sync the driver content with the device.


### clearBuffer()

Fill the entire display buffer with 0x00.


### setCursor(x, y)

Set the X and Y coordinates for the drawString() cursor position.

> NOTE: the cursor position is the upper left corner of the next character to be drawn.


### fontToImageMap(font, transparent)

Convert a font object from the oled-js format to an image map for use in the display
module.

The oled-sh1106 module utilizes a font format where each character is an
image used in the drawImage() method. This enables transparency as an option in
fonts.

Many available fonts are in a format as used by [noopkat](https://github.com/noopkat/oled-font-5x7).
These fonts can be passed into the fontToImageMap() method to convert them into
an image map for the drawString() method.

The *transparent* option is a boolean that can be used to turn the dark pixels in
the font image map into transparent pixels. Transparent fonts drawn on top of existing
content will show the content through the transparent pixels.

Example
```javascript
const FiveSevenFont = require('./oled-font-5x7');
const FSFontImageMap = Display.fontToImageMap(FiveSevenFont);
Display.drawString('Hello world!\n', FSFontImageMap);
```


### drawString(str, fontIM, wrap)

Draw a string in the display buffer. Pass the string to draw, the font image map
to use, and optional use a boolean to specify if the string should wrap if it is
wider than the display.

```javascript
const FiveSevenFont = require('./oled-font-5x7');
const FSFontImageMap = Display.fontToImageMap(FiveSevenFont);
Display.drawString('This is a long string that must wrap to fit the display.', FSFontImageMap, true);
```


### drawPixels(pixels)

Draw pixels in the display buffer. Each pixel is an array [x, y, color] where
color is 1 for on and 0 for off.

```javascript
// draw a small box with pixels
Display.drawPixels([
  [0, 0, 1], [1, 0, 1], [2, 0, 1],
  [0, 1, 1], [1, 1, 0], [2, 1, 1],
  [0, 2, 1], [1, 2, 1], [2, 2, 1]
]);
```


### drawLine(x0, y0, x1, y1, color)

Draw a line in the display buffer from x0, y0 to x1, y1 using color value.


### drawFillRect(x, y, w, h, color)

Draw a filled rectangle in the display buffer at x, y with width and height w, h
using color value.


### drawImage(dx, dy, image)

Draw an image in the display buffer.

Images must be objects in the format produced by [pngparse](https://www.npmjs.com/package/pngparse).

```javascript
{
  width: <image width>,
  height: <image height>,
  channels: <color channels, supports transparency in 2 and 4 channels>,
  data: <buffer>
}
```

Example
```javascript
const PNGParse = require('pngparse');
loadImage('./test.png')
.then(image => {
  Display.drawImage(20, 10, image);
  Display.updateDisplay();
})
.catch(err => {
  console.log('Error:', err.message);
  process.exit(1);
});

function loadImage(filepath) {
  return new Promise((resolve, reject) => {
    PNGParse.parseFile(filepath, (err, image) => {
      resolve(image);
    });
  });
}
```


### async sendBuffer()

Send the entire display buffer contents to the device. This must be handled as an
async method. This will overwrite the entire display RAM contents.

Example
```javascript
Display.sendBuffer()
.then(() => {
  console.log('Send complete.');
})
.catch(err => {
  console.log('Error:', err.message);
  process.exit(1);
});
```


### async updateDisplay()

The updateDisplay() method will send only the changes made to the display buffer
and will in most cases be faster than using the sendBuffer() method.

This method is also an async method and must be used accordingly.


### async reverseDisplay(bool)

Reverses or inverts the way color channels are displayed on the device.


### async displayContrast(c)

Set the display contrast or brightness level. Values from 0x00 to 0xFF are possible.


### async displayOff()

Turn the OLED display off. This will conserve power without losing the display RAM
contents.


### async displayOn()

Turn the OLED display on.


### getInitSequence()

Returns an array of command bytes that are used for the device initialization.
Normally this is only used internally by the display module.


## Example

See the example directory for a working example based on the WaveShare 1.3 inch
OLED HAT device.


```javascript
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
```
