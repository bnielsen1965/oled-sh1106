
module.exports = {
  // RAM has 132 columns and is addressed with two commands for the high and low nybble
  SET_COL_ADDR_LB: 0x00, // | [0x00 - 0x0F]
  SET_COL_ADDR_HB: 0x10, // | [0x00 - 0x83]

  // 0x00 = 6.4, 0x01 = 7.4, 0x02 = 8 (default), 0x03 = 9
  SET_PUMP_VOLTAGE: 0x30, // | [0x00 - 0x03]

  // used for smooth scrolling
  SET_DISPLAY_START_LINE: 0x40, // | [0x00 - 0x3F]

  // (double byte command) follow command with contrast value
  SET_CONTRAST: 0x81, // , [0x00 - 0xFF]

  // map direction of RAM columns to display
  SET_SEGMENT_REMAP: 0xA0, // | [0x00 - 0x01]

  // 0x00 = normal display, 0x01 = entire display on
  SET_ENTIRE_DISPLAY_ON_OFF: 0xA4, // | [0x00 - 0x01]

  // set display output to reverse or normal of RAM contents (invert disiplay)
  SET_DISPLAY_REVERSE: 0xA6, // | [0x00 - 0x01]

  // (double byte command) multiplex ratio for COM0-COM63 ???
  SET_MULTIPLEX_RATIO: 0xA8, // , [0x00 - 0x3F]

  // (double byte command) set DC-DC voltage converter on/off (set display off before issuing command)
  SET_DCDC_ON_OFF: 0xAD, // , [0x8A (off) or 0x8B (on)]

  // Turns display on/off, 0x00 = power save mode, 0x01 = on
  DISPLAY_ON_OFF: 0xAE, // | [0x00 - 0x01]

  // set RAM page address register
  SET_PAGE_ADDRESS: 0xB0, // | [0x00 - 0x07]

  // Set common output scan direction (vertical flip)
  SET_COMMON_OUTPUT_SCAN_DIRECTION: 0xC0, // | [0x00 or 0x08]

  // (double byte command) set display offset for display start line COM0-63
  SET_DISPLAY_OFFSET: 0xD3, // , [0x00 - 0x3F]

  // (double byte command) set display clock divide ratio/oscillator frequency
  SET_DISPLAY_CLOCK_RATIO: 0xD5, // , [0x00 - 0xFF]

  // (double byte command) set discharge/precharge period
  SET_CHARGE_PERIOD: 0xD9, // , [0x01 - 0xFF]

  // (double byte command) set common pads hardware configuration mode
  SET_COMMON_PAD_CONFIG: 0xDA, // , [0x02 or 0x12]

  // (double byte command) set VCOM deselect level
  SET_VCOM_LEVEL: 0xDB, // , [0x00 - 0xFF]

  // start read-modify-write mode
  START_READ_MODIFY_WRITE_MODE: 0xE0,

  // end read-modify-write mode
  END_READ_MODIFY_WRITE_MODE: 0xEE,

  // non-operation
  NOP: 0xE3
};
