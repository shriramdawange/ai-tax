import express from 'express';
import { Pool } from 'pg';
import { saasRoutes, authRequired } from './saas.js';
import { productionRoutes } from './production-routes.js';
import { part2Routes } from './part2-routes.js';
import { part3Routes } from './part3-routes.js';
import { part4Routes } from './part4-routes.js';
import { part5Routes } from './part5-routes.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'25mb'}));
const pool=new Pool({connectionString:process.env.DATABASE_URL??'postgres://ai_tax:ai_tax_dev@localhost:5432/ai_tax',max:Number(process.env.DB_POOL_SIZE??10)});

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:true,service:'ai-tax-production'});}catch{res.status(503).json({ok:false,database:false,service:'ai-tax-production'});}});
app.use('/api/saas',saasRoutes(pool));
app.use('/api/app',productionRoutes(pool));

const tenantRouter=(factory:(pool:Pool,org:string)=>express.Router())=>[authRequired(pool),(req:express.Request,res:express.Response,next:express.NextFunction)=>factory(pool,req.auth!.organizationId)(req,res,next)];
// Existing domain routers retain their canonical paths under /api/app.
app.use('/api/app',...tenantRouter((p,o)=>part2Routes(p,o)));
app.use('/api/app',...tenantRouter((p,o)=>part3Routes(p,o)));
app.use('/api/app',...tenantRouter((p,o)=>part4Routes(p,o)));
app.use('/api/app',authRequired(pool),part5Routes());

app.get('/',(_req,res)=>res.sendFile('app.html',{root:'public'}));
app.use(express.static('public'));
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);if(res.headersSent)return;res.status(500).json({error:process.env.NODE_ENV==='production'?'Internal server error':String(err?.message??err)});});

const port=Number(process.env.PORT??3000);
app.listen(port,()=>console.log(`AI TAX production server listening on http://localhost:${port}`));
