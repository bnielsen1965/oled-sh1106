
const Constants = require('./constants');

// SH1106 OLED driver methods
class Display {
  // sendCommand = (required) function to send command to device
  // sendData = (required) function to send data to device
  // hardwareReset = (required) function to reset the hardware
  // displayColumns = (required) the number of columns or width of the display
  // displayRows = (required) the number for rows or height of the display
  // columnOffset = (optional) column offset in RAM
  // multiplexRatio = (recommended) the display device multiplex ratio setting
  // commonPadConfig = (recommended) the display device common pad configuration setting
  // lineSpacing = (optional) space between lines when writing strings
  // letterSpacing = (optional) space between characters when writing characters
  constructor(config) {
    if (!config) {
      throw new Error('Display settings required');
    }
    ['displayColumns', 'displayRows', 'sendCommand', 'sendData', 'hardwareReset']
    .map(method => {
      if (!config.hasOwnProperty(method)) {
        throw new Error('Missing required property ' + method);
      }
    });

    this.Config = config;
    this.Config.lineSpacing = typeof config.lineSpacing !== 'undefined' ? config.lineSpacing : 1;
    this.Config.letterSpacing = typeof config.letterSpacing !== 'undefined' ? config.letterSpacing : 1;
    this.Config.multiplexRatio = typeof config.multiplexRatio !== 'undefined' ? config.multiplexRatio : 0x3F;
    this.Config.commonPadConfig = typeof config.commonPadConfig !== 'undefined' ? config.commonPadConfig : 0x12;

    this.buffer = Buffer.alloc(this.Config.displayColumns * this.Config.displayRows);
    this.clearBuffer();
    this.dirtyBytes = {};
    this.cursorx = 0;
    this.cursory = 0;
  }

  // initialize the display
  async init() {
    await this.Config.hardwareReset();
    await this.displayOff();
    await this.Config.sendCommand(this.getInitSequence());
    await this.sendBuffer();
    await this.displayOn();
  }

  // clear the display buffer contents
  clearBuffer() {
    this.buffer.fill(0x00);
  }


  // set starting position of a text string on the oled
  setCursor(x, y) {
    this.cursorx = x;
    this.cursory = y;
  }

  // convert an oled js font to a font image map
  fontToImageMap(font, transparent) {
    let fontIM = { width: font.width, height: font.height };
    let colPages = Math.ceil(font.height / 8); // number of byte pages to represent column
    let charBytes = colPages * font.width; // bytes per character
    let padBits = (colPages * 8) % font.height; // height may be less total bit height
    for (let li = 0; li < font.lookup.length; li++) {
      let idata = [];
      let cdata = font.fontData.slice(li * charBytes, (li + 1) * charBytes);
      for (let p = 0; p < colPages; p++) {
        for (let b = 0; b < 8; b++) {
          if (!p && b >= 8 - padBits) { continue; } // first page may have padding bits
          let bitMask = 0x01 << b; // create mask for this bit position in char byte
          for (let c = 0; c < font.width; c++) {
            let pixelState = cdata[c + p * font.width] & bitMask ? 1 : 0;
            idata.push(pixelState);
            if (transparent) { idata.push(pixelState ? 0xff : 0x00); }
          }
        }
      }
      fontIM[font.lookup[li]] = {
        width: font.width,
        height: font.height,
        channels: (transparent ? 2 : 1),
        data: Buffer.from(idata)
      };
    }
    return fontIM;
  }


  // check if a coordinate is clipped
  clipped(x, y) {
    if (this.Config.clippedMethod) {
      return this.Config.clippedMethod(x, y);
    }
    if (x !== null && (x < 0 || x >= this.Config.displayColumns)) {
      return true;
    }
    if (
      y !== null && (y < 0 || y >= this.Config.displayRows)) {
      return true;
    }
    return false;
  }


  // set an external clipping method
  setClipped(clippedMethod) {
    this.Config.clippedMethod = clippedMethod;
  }


  // draw a string using provided font image map
  drawString(str, fontIM, wrap) {
    let words = str.split(' ');
    let colOffset = this.cursorx;
    for (let wi = 0; wi < words.length; wi++) {
      // handle word wrapping
      if (wrap && wi && colOffset > 0 && colOffset + fontIM.width * words[wi].length > this.Config.displayColumns) {
        colOffset = 0;
        this.cursory += fontIM.height + this.Config.lineSpacing;
        this.setCursor(colOffset, this.cursory);
      }
      // replace lost space between words
      if (wi < words.length - 1 || !words[wi].length) {
        words[wi] += ' ';
      }
      let wordChars = words[wi].split('');
      for (let ci = 0; ci < wordChars.length; ci++) {
        if (wordChars[ci] === '\n') {
          colOffset = 0;
          this.cursory += fontIM.height + this.Config.lineSpacing;
          this.setCursor(colOffset, this.cursory);
        }
        else if (fontIM[wordChars[ci]]) {
          let charImage = fontIM[wordChars[ci]];
          this.drawImage(colOffset, this.cursory, charImage);
          if (charImage.channels !== 2 && charImage.channels !== 4) {
            // not transparent font, draw spacing
            this.drawFillRect(colOffset, this.cursory + charImage.height + 1, charImage.width, this.Config.lineSpacing, 0);
            this.drawFillRect(colOffset + charImage.width + 1, this.cursory, this.Config.letterSpacing, charImage.height + this.Config.lineSpacing, 0);
          }
          colOffset += charImage.width + this.Config.letterSpacing;
          // check if wrap and no room for next char
          if (wrap && colOffset >= this.Config.displayColumns - fontIM.width) {
            colOffset = 0;
            this.cursory += fontIM.height + this.Config.lineSpacing;
          }
          this.setCursor(colOffset, this.cursory);
        }
      }
    }
  }

  // draw pixels in the buffer, pixels is an array where each element is an array [x, y, color]
  drawPixels(pixels) {
    // if one pixel is passed then convert to array of one pixel
    if (typeof pixels[0] !== 'object') pixels = [pixels];
    let pixelByte;
    let bufferPage;
    let bufferOffset;
    let bufferByte;

    pixels.forEach(pixel => {
      // don't process if coords are outside of display buffer
      if (this.clipped(pixel[0], pixel[1])) {
        return;
      }

      // determine buffer page and column byte from pixel y coord
      bufferPage = Math.floor(pixel[1] / 8);
      pixelByte = 0x01 << (pixel[1] - 8 * bufferPage);

      // determine offset into buffer from x coord and page
      bufferOffset = pixel[0] + this.Config.displayColumns * bufferPage;

      // determine the buffer byte value
      bufferByte = this.buffer[bufferOffset];
      if (pixel[2] === 'BLACK' || pixel[2] === 0) {
        // turn pixel off by inverting pixel column byte and anding with existing buffer column byte
        bufferByte &= ~pixelByte;
      }
      if (pixel[2] === 'WHITE' || pixel[2] > 0) {
        // turn pixel on by anding pixel column byte with existing buffer column byte
        bufferByte |= pixelByte;
      }

      // did the byte change?
      if (this.buffer[bufferOffset] !== bufferByte) {
        this.buffer[bufferOffset] = bufferByte;
        this.dirtyBytes[bufferPage] = this.dirtyBytes[bufferPage] || {};
        this.dirtyBytes[bufferPage][pixel[0]] = bufferByte;
      }
    }, this);
  }


  // using Bresenham's line algorithm
  drawLine(x0, y0, x1, y1, color) {
    x0 = x0 || 0;
    y0 = y0 || 0;
    x1 = x1 || 0;
    y1 = y1 || 0;
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0);
    let sx = x0 < x1 ? 1 : -1;
    let dy = Math.abs(y1 - y0);
    let sy = y0 < y1 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2;
    let linePixels = [];
    while (true) {
      linePixels.push([x0, y0, color]);
      if (x0 === x1 && y0 === y1) {
        this.drawPixels(linePixels);
        break;
      }
      let e2 = err;
      if (e2 > -dx) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dy) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // draw a filled rectangle on the oled
  drawFillRect(x, y, w, h, color) {
    x = x || 0;
    y = y || 0;
    w = w || 0;
    h = h || 0;
    // one iteration for each column of the rectangle
    for (let i = x; i < x + w; i += 1) {
      // draws a vert line
      this.drawLine(i, y, i, y + h - 1, color, false);
    }
  }

  // draw image from pngparse at the specified coordinates
  drawImage(dx, dy, image) {
    dx = dx || 0;
    dy = dy || 0;
    let dyy;
    let dxx;
    let dyyPage;
    let dxxByte = null;
    let bufferOffset = 0;
    let page;
    let imageOffset;
    let pixelByte;
    let color;

    // outer loop through columns
    for (let x = 0; x < image.width; x++) {
      dxx = dx + x;
      if (this.clipped(dxx, null)) {
        continue;
      }
      page = -1; // reset page
      // inner loop through rows
      for (let y = 0; y < image.height; y++) {
        dyy = dy + y;
        if (this.clipped(null, dyy)) {
          continue;
        }
        // calculate buffer page for y coord
        dyyPage = Math.floor(dyy / 8);
        // check if new page
        if (dyyPage > page) {
          // if we have a byte and it differs from buffer then save
          if (dxxByte !== null && dxxByte !== this.buffer[bufferOffset]) {
            this.buffer[bufferOffset] = dxxByte;
            this.dirtyBytes[page] = this.dirtyBytes[page] || {};
            this.dirtyBytes[page][dxx] = dxxByte;
          }
          // prepare settings for new page
          page = dyyPage;
          bufferOffset = page * this.Config.displayColumns + dxx;
          dxxByte = this.buffer[bufferOffset];
        }
        // calculate offset into image data (4 bytes per RGBA pixel)
        imageOffset = (image.width * image.channels * y + image.channels * x);

        // transparency check
        if (image.channels === 2 || image.channels === 4) {
          if (!image.data[imageOffset + (image.channels - 1)]) { continue; }
        }

        // convert pixel y position into buffer column byte
        pixelByte = 0x01 << (dyy - 8 * dyyPage);
        // convert image pixel color to monochrome
        color = (image.channels < 3 ? image.data[imageOffset] : image.data[imageOffset] || image.data[imageOffset + 1] || image.data[imageOffset + 2]);

        // apply pixel to buffer byte
        if (color) {
          dxxByte |= pixelByte;
        }
        else {
          dxxByte &= ~pixelByte;
        }
      }
      // if we have a byte and it differs from buffer then save
      if (dxxByte !== null && dxxByte !== this.buffer[bufferOffset]) {
        // save byte
        this.buffer[bufferOffset] = dxxByte;
        this.dirtyBytes[page] = this.dirtyBytes[page] || {};
        this.dirtyBytes[page][dxx] = dxxByte;
      }
      dxxByte = null;
    }
  }


  // send the entire buffer to the display
  async sendBuffer() {
    // setup RAM addressing
    let set_page_address = Constants.SET_PAGE_ADDRESS | 0x00;
    let set_col_low_bits = Constants.SET_COL_ADDR_LB | this.Config.columnOffset;
    let set_col_high_bits = Constants.SET_COL_ADDR_HB | 0x00;
    for (let y = 0; y < this.Config.displayRows / 8; y++) {
      // set RAM address before write
      await this.Config.sendCommand([set_page_address, set_col_low_bits, set_col_high_bits]);
      let offset = y * this.Config.displayColumns;
      // get page from buffer and write to RAM
      let pageBuffer = Buffer.from(this.buffer.slice(offset, offset + this.Config.displayColumns));
      await this.Config.sendData(pageBuffer);
      set_page_address += 1; // next page
    }
  }

  // update display RAM with changes made to the display buffer
  async updateDisplay() {
    let pages = Object.keys(this.dirtyBytes);
    pages.sort();
    if (!pages.length) { return; }
    for (let pi = 0; pi < pages.length; pi++) {
      let columns = Object.keys(this.dirtyBytes[pages[pi]]);
      columns.sort();
      if (columns.length) {
        // simple efficiency, write all buffer bytes from dirty min x to max x
        let minx = Math.min(...columns);
        let maxx = Math.max(...columns);
        // setup RAM addressing
        let columnAddr = minx + this.Config.columnOffset;
        let set_page_address = Constants.SET_PAGE_ADDRESS | pages[pi];
        let set_col_low_bits = Constants.SET_COL_ADDR_LB | (columnAddr & 0x0F);
        let set_col_high_bits = Constants.SET_COL_ADDR_HB | ((columnAddr & 0xF0) >> 4);
        await this.Config.sendCommand([set_page_address, set_col_low_bits, set_col_high_bits]);
        // send the buffer contents that cover the entire range of changed columns
        let offset = pages[pi] * this.Config.displayColumns + minx;
        let pageBuffer = Buffer.from(this.buffer.slice(offset, offset + (maxx - minx) + 1));
        await this.Config.sendData(pageBuffer);
      }
      delete this.dirtyBytes[pages[pi]];
    }
  }

  // reverse the display, on pixels show as off and off pixels show as on
  async reverseDisplay(bool) {
    await this.Config.sendCommand([Constants.SET_DISPLAY_REVERSE | (bool ? 0x01 : 0x00)])
  }

  async displayContrast(c) {
    await this.Config.sendCommand([Constants.SET_CONTRAST, c & 0xFF]);
  }

  async displayOff() {
    await this.Config.sendCommand([Constants.DISPLAY_ON_OFF]);
  }

  async displayOn() {
    await this.Config.sendCommand([Constants.DISPLAY_ON_OFF | 0x01]);
  }

  // get an array of command bytes to initialze the display device
  getInitSequence() {
    return [
      Constants.SET_COL_ADDR_LB | 0x00,
      Constants.SET_COL_ADDR_HB | 0x00,
      Constants.SET_SEGMENT_REMAP | 0x00,
      Constants.SET_DISPLAY_REVERSE | 0x00,
      Constants.SET_MULTIPLEX_RATIO, this.Config.multiplexRatio,
      Constants.SET_ENTIRE_DISPLAY_ON_OFF | 0x00,
      Constants.SET_DISPLAY_OFFSET, 0x00,
      Constants.SET_DISPLAY_CLOCK_RATIO, 0xF0,
      Constants.SET_CHARGE_PERIOD, 0x22,
      Constants.SET_COMMON_PAD_CONFIG, this.Config.commonPadConfig,
      Constants.SET_VCOM_LEVEL, 0x20
    ];
  }
};


module.exports = config => {
  return new Display(config);
};
