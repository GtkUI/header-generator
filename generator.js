#!/usr/bin/node

// Libraries
const convert = require('xml-js');
const fs = require('fs');
const path = require('path');

// Constants
const error = (message) => { console.error("Error: " + message); process.exit(1); };
const GIR_PATH = "/usr/share/gir-1.0";
const CTYPE_MAP = {
  "gchar*": "String",
  "gboolean": "Bool",
  "gint": "Number",
  "gfloat": "Number",
  "gdouble": "Number",
  "guint": "Number",
}
const TYPE_MAP = {
  "Align": "String",
  "Orientation": "String"
}

// Argument Parsing
let TARGET_GIR = process.argv[2];
let OUTPUT_FILE = process.argv[3];
let LIBRARY = { name: null, version: null };

if (process.argv.length <= 2) {
  console.log(`./parser.js TARGET_GIR [OUTPUT_FILE]`);
  process.exit(0);
}
if (!TARGET_GIR) error("No target gir.");
if (!fs.existsSync(TARGET_GIR)) {
  TARGET_GIR = `${GIR_PATH}/${TARGET_GIR}.gir`
  if (!fs.existsSync(TARGET_GIR)) error("Target gir not found. (File does not exist)");
}

// Parsing the xml .gir file
let json = convert.xml2js(
  fs.readFileSync(TARGET_GIR, {encoding: "utf8"})
).elements.find(v => v.name == "repository").elements.find(v => v.name == "namespace")

LIBRARY.name = json.attributes.name.toLowerCase();
LIBRARY.version = json.attributes.version;

const widgets = json.elements.filter(v => v.name == 'class');
let definitions = [] // { name, parent, children[], properties: { name, type } }[]

// Parse every widget into a specificly formatted array of objects
for (let widget of widgets) {
  let definition = {
    name: widget.attributes['glib:type-name'],
    parent: null,
    children: [],
    properties: []
  };
  let parent = widgets.find(v => v.attributes.name == widget.attributes.parent);
  if (parent) definition.parent = parent.attributes['glib:type-name'];

  if (!widget.elements) continue;
  
  for (let property of widget.elements.filter(v => v.name == "property")) {
    let property_name = property.attributes.name;
    let type = property.elements.find(v => v.name == "type");
    if (!type || !type.attributes) continue;
    let ctype = type.attributes['c:type'];
    if (ctype) {
      if (CTYPE_MAP[ctype]) definition.properties.push({
        name: property_name,
        type: CTYPE_MAP[ctype]
      })
      else console.warn(`Warning: Couldn't find ctype '${ctype}', ignoring`);
    } else {
      let type_name = type.attributes.name;
      if (TYPE_MAP[type_name]) definition.properties.push({
        name: property_name,
        type: TYPE_MAP[type_name]
      })
      else {
        console.warn(`Warning: Couldn't find type '${type_name}', using String instead`);
        definition.properties.push({
          name: property_name,
          type: "String"
        })
      }
    }
  }
  definitions.push(definition);
}

function find_definition(name, defs) {
  for (let definition of defs) {
    if (definition.name == name) return definition;
    let result = find_definition(name, definition.children);
    if (result) return result;
  }
  return false;
}

// Create a tree of inheritance
let index = 0;
while (definitions.length != 1 && index < definitions.length) {
  let definition = definitions[index];
  let parent = find_definition(definition.parent, definitions);
  if (parent) parent.children.push(definitions.splice(index, 1)[0]);
  else ++index;
}

// Generate the file from the tree of inheritance
function generate_file(defs) {
  let file_content = "";
  for (let definition of defs) {
    file_content += `@${definition.name} ${definition.parent ? '-> ' + definition.parent + ' ' : ''}{\n`;
    for (let property of definition.properties) {
      file_content += `\t@ChildProp("${property.name}", ${property.type})\n`;
    }
    file_content += '}\n';
    file_content += generate_file(definition.children);
  }
  return file_content;
}

// Make sure to include the header


let header = `#header "<requires lib=\\"${LIBRARY.name}\\" version=\\"${LIBRARY.version}\\"/>"\n\n`

// Write the file
fs.writeFileSync(!OUTPUT_FILE ? `${LIBRARY.name}-${LIBRARY.version}.gui` : OUTPUT_FILE, header + generate_file(definitions));
