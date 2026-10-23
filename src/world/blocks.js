const block = (id, name, category, color, options = {}) => ({
  id, name, category, color,
  solid: options.solid !== false,
  opaque: options.opaque !== false,
  breakable: options.breakable !== false,
  selectable: options.selectable !== false,
  replaceable: options.replaceable === true,
  layer: options.layer || 'opaque',
  top: options.top || color,
  bottom: options.bottom || color,
  side: options.side || color,
  pattern: options.pattern || 'noise'
});

export const BLOCKS = [
  block(1, 'Grass', 'Terrain', '#6da63c', { top: '#64b640', side: '#765438', bottom: '#765438', pattern: 'grass' }),
  block(2, 'Dirt', 'Terrain', '#805a3d'),
  block(3, 'Cobblestone', 'Terrain', '#828581', { pattern: 'stone' }),
  block(4, 'Oak Planks', 'Wood', '#b69055', { pattern: 'planks' }),
  block(5, 'Oak Log', 'Wood', '#755534', { top: '#b79463', bottom: '#b79463', pattern: 'log' }),
  block(6, 'Oak Leaves', 'Nature', '#468f39', { opaque: false, layer: 'cutout', pattern: 'leaves' }),
  block(7, 'Glass', 'Building', '#b2eaff', { opaque: false, layer: 'transparent', pattern: 'glass' }),
  block(8, 'Bricks', 'Building', '#a84d3e', { pattern: 'bricks' }),
  block(9, 'Sand', 'Terrain', '#e2d08c'),
  block(10, 'Gold', 'Building', '#f5ce35', { pattern: 'ore' }),
  block(11, 'Water', 'Nature', '#4386dd', { solid: false, opaque: false, selectable: false, replaceable: true, layer: 'transparent', pattern: 'water' }),
  block(12, 'Smooth Stone', 'Terrain', '#a5a9a4'),
  block(13, 'Bedrock', 'Terrain', '#353c3c', { breakable: false, selectable: false, pattern: 'stone' }),
  block(14, 'Spruce Planks', 'Wood', '#896441', { pattern: 'planks' }),
  block(15, 'Spruce Log', 'Wood', '#4f3c32', { top: '#b39773', bottom: '#b39773', pattern: 'log' }),
  block(16, 'Birch Planks', 'Wood', '#d5c39c', { pattern: 'planks' }),
  block(17, 'Sandstone', 'Building', '#c9b77c', { pattern: 'stone' }),
  block(18, 'White Wool', 'Colour', '#e9e8dc'),
  block(19, 'Red Wool', 'Colour', '#c74842'),
  block(20, 'Blue Wool', 'Colour', '#4474bc'),
  block(21, 'Yellow Wool', 'Colour', '#e7c547'),
  block(22, 'Green Wool', 'Colour', '#5a9d54'),
  block(23, 'Black Wool', 'Colour', '#3c3e47'),
  block(24, 'Clay', 'Building', '#ad948b'),
  block(25, 'Snow', 'Nature', '#e7f4f3'),
  block(26, 'Glowstone', 'Building', '#edbb58', { pattern: 'ore' })
];

export const BLOCK_BY_ID = new Map(BLOCKS.map((item) => [item.id, item]));
export const SELECTABLE_BLOCKS = BLOCKS.filter((item) => item.selectable);
export const CATEGORIES = ['Terrain', 'Building', 'Wood', 'Nature', 'Colour'];
export const getBlockDef = (id) => BLOCK_BY_ID.get(id);
