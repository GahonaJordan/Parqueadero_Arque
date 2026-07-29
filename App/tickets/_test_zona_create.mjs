const base=(process.env.MS_ZONAS||'http://localhost:8081/api').replace(/\/+$/,'').replace(/\/espacios$/i,'').replace(/\/zonas$/i,'');
console.log('base', base);
const body={nombre:'Zona Seed Fix '+Date.now().toString().slice(-6),descripcion:'demo',capacidad:50,tipo:'GENERAL',activo:true};
fetch(base+'/zonas',{method:'POST',headers:{'Content-Type':'application/json','X-Internal-Key':'internal-service-key-parcial2'},body:JSON.stringify(body)}).then(async r=>{console.log('POST',r.status); console.log(await r.text());}).catch(e=>console.error(e));
