'use strict';
const {deflateRawSync}=require('node:zlib');
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// ZIP with UTF-8 names, DEFLATE and fixed timestamps: no OS tools or ZIP dependency.
function zipEntries(entries){const local=[],central=[];let offset=0;
  for(const entry of [...entries].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const name=entry.name.replaceAll('\\','/');if(name.startsWith('/')||name.split('/').some(s=>s==='..'||s==='')||name.includes(':'))throw new Error('Ruta de archivo no válida');
    const filename=Buffer.from(name,'utf8'),data=Buffer.from(entry.data),compressed=deflateRawSync(data,{level:9}),crc=crc32(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
    local.push(header,filename,compressed);
    const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);central.push(record,filename);offset+=header.length+filename.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);if(entries.length>65535||offset+directory.length>0xffffffff)throw new Error('Paquete demasiado grande');end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
module.exports={zipEntries};
