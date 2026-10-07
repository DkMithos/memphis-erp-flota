-- ─────────────────────────────────────────────────────────────────────────────
-- CONDICIÓN TRIBUTARIA Y CUENTAS DE PROVEEDORES desde la lista de Contabilidad
-- (2026-10-07, sprint 0 del plan de pagos)
--
-- Fuente: "01. Contabilidad/Copia de Listado Proveedores.xlsx" (hojas Proveedores
-- y Cuentas). Contabilidad mantiene ahí, por RUC, si el proveedor es buen
-- contribuyente, agente de percepción o agente de retención (en esos casos
-- Memphis NO le retiene el 3 %), y si "SI APLICA" la retención. Es exactamente
-- el dato que el lote de pago necesitaba y que en el ERP estaba en cero.
--
-- Regla SUNAT que refleja: Memphis es agente de retención del IGV; retiene 3 %
-- a todo proveedor salvo buenos contribuyentes, agentes de retención y agentes
-- de percepción. `sujeto_retencion` = "SI APLICA" de la lista.
--
-- Cuentas: se agregan al arreglo `cuentas_bancarias` solo las que el ERP no
-- tenía (comparando el número sin separadores). No se borra ni reemplaza nada.
-- ─────────────────────────────────────────────────────────────────────────────

alter table proveedores
  add column if not exists buen_contribuyente boolean not null default false,
  add column if not exists agente_retencion   boolean not null default false,
  add column if not exists agente_percepcion  boolean not null default false;

create temp table cond_conta (ruc text, razon text, bc boolean, ap boolean, ar boolean, ret boolean);
insert into cond_conta values
('20604158657','A&S DISTRIBUCIONES E.I.R.L.',false,false,false,true),
('20610349502','ACCEQUIPMINER EIRL',false,false,false,true),
('20605674136','ANDESA GLOBAL S.A.C',false,false,false,true),
('20611591731','ANDIBER S.A.C.',false,false,false,true),
('10419692382','ATAUJE FLORES ALFREDO "EVOLUTION CAAF"',false,false,false,true),
('20516062305','AUTOFONDO S.A.C',false,false,true,false),
('20601952751','AUTOMANDO S.A.C',false,false,false,true),
('20601762219','AUTONIZA S.A.C.',false,false,true,false),
('15608248436','BARBARA DEL CARMEN COLMENARES GUZMÁN',false,false,false,true),
('20612565202','BETTER THINGS PERÚ SAC',false,false,false,true),
('20493524179','BOULLOSA MOTORS S.R.L',false,false,false,true),
('10100045597','BRENNER BEAZLEY EDUARDO HERMANN',false,false,false,true),
('20604767092','C&S IMPLEMENTA S.A.C.',false,false,false,true),
('20612282375','CAMITEK S.A.C.',false,false,false,true),
('10105603687','CARLOS CORTANTE CORANTES',false,false,false,true),
('20609123720','CDG Diversol S.A.C.',false,false,false,true),
('10067461482','CHUNGA LOPEZ DANTE AUGUSTO',false,false,false,true),
('20554916407','CMC MULTIMEDIA S.A.C.',false,false,false,true),
('20330096749','COMSATEL PERU SAC',false,false,false,true),
('20600297148','CONDUVEX S.A.C.',false,false,false,true),
('20605827803','CONSULTAS Y SERVICIOS G & P SOCIEDAD ANONIMA CERRADA',false,false,false,true),
('20602292801','CONTROL Y BIENES',false,false,false,true),
('20563707578','CORPORACION AURA E.I.R.L.',false,false,false,true),
('10406430711','CYNTHIA CAROLINA CHINCHAY CALLE (EAGLE GAMING)',false,false,false,true),
('20553404631','DAILY TECHNOLOGY S.A.C.',false,false,false,true),
('10075142914','DE LA CRUZ SANTOS EMMA DONATILA',false,false,false,true),
('20548660034','DENNIS CAR S.A.C.',false,false,false,true),
('20603957564','DESPEGATEC PERU S.A.C.',false,false,false,true),
('20609787903','DKT SOLUCIONES S.A.C.',false,false,false,true),
('20606600985','EMERGENCY PERU S.A.C',false,false,false,true),
('20608659425','EMERGENCY SURVIVAL S.A.C.',false,false,false,true),
('20100041520','EXIMPORT DISTRIBUIDORES DEL PERU S.A',false,false,true,false),
('20520751140','FACTORIA RCH',false,false,false,true),
('10463104510','FARFAN BRICEÑO JORGE ALFREDO',false,false,false,true),
('10309536288','FLORES QUILLE JOSÉ CIRILO',false,false,false,true),
('10720897275','FRANS ROBER GOMEZ BARRIENTOS',false,false,false,true),
('20555187859','FUMIGACIONES Y EXTINTORES EXPRESS EIRL',false,false,false,true),
('20612376744','GAIA ENVIRONMENTAL SERVICES E.I.R.L.',false,false,false,true),
('20607086185','GAMAN AUTOS S.A.C.',false,false,true,false),
('20600137094','GEOSATELITAL PERU E.I.R.L. - GEOSATELITAL E.I.R.L.',false,false,false,true),
('107345501536','GEREMIE KEVIN CALLUCO QUISPE',false,false,false,true),
('20536465813','GESTIONA, ASESORÍA PERÚ S.A.C.',false,false,false,true),
('20297867718','GRUPO ALESE',false,false,true,false),
('20603768168','GRUPO CAMARO SAC',false,false,false,true),
('20610215018','GRUPO EUROTEC E.I.R.L.',false,false,false,true),
('20553008795','HMF SMART SOLUTIONS GMBH SUCURSAL DEL PERU',false,false,true,false),
('20521730944','IMAGIAN SRL',false,false,false,true),
('20552919344','Importadora Mmash S.A.C.',false,false,false,true),
('20549672338','INVERSIONES ECOLIM S.A.',true,false,false,false),
('20454742321','J. G Y R S.A.C.  (CIGÜEÑAS EL PAISA)',false,false,false,true),
('20318171701','J.CH.COMERCIAL S.A.',false,true,false,false),
('10467012547','JIM INDUSTRIAL',false,false,false,true),
('15613345148','JOSE GABRIEL LOPEZ GRANDETT',false,false,false,true),
('10257202475','José Pineyro Fernández',false,false,false,true),
('20502654048','JR PIMA S.R.L.',true,false,false,false),
('20603142544','KING´S SOLUCIONES LOGISTICAS S.A.C.',false,false,false,true),
('20606076127','KPN PERÚ S.A.C.',false,false,false,true),
('20468450217','LQ TRADING IMPORT EXPORT S.A.C',false,false,true,false),
('20600184777','LUBRIACCESORIOS VIRGEN DEL CARMEN',false,false,false,true),
('20602750303','MACOR INGENIEROS S.R.L.',false,false,false,true),
('20379331042','MACROMEDICA S.A.',false,false,false,true),
('20407865112','MAKI ASOCIADOS S.A.C.',false,false,true,false),
('10063187483','MARIO ALFREDO RIVERA CHÁVEZ',false,false,false,true),
('20536675621','MASTER TIRES SAC',false,false,false,true),
('20507115102','MOMARENTO EIRL',false,false,false,true),
('20551701698','MOVIMENTS STUDIO S.R.L.',false,false,false,true),
('20612434434','MSCA SERVICIOS GENERALES E INMOBILIARIOS E.I.R.L',false,false,false,true),
('10455864980','NADIA FULL TAPIZ',false,false,false,true),
('10067848140','NOTARIA SANTIAGO RAFAEL CÁRDENAS VILLACORTA',false,false,false,true),
('10466239467','ÑACA INQUILLA LUZMILA',false,false,false,true),
('10416630157','OSCAR RENEE SEJJE MAMANI',false,false,false,true),
('10419673540','PEREYRA ORTEGA MANUEL ANIBAL',false,false,false,true),
('20453919651','PERUANA DE MOTORES HG SAC',false,false,true,false),
('20100084768','PEVISA AUTO PARTS S.A.C.',false,false,true,false),
('20517268551','PROGRESO GENERAL E.I.R.L',false,false,false,true),
('20294560204','PROMOTORA GENESIS S.A.C.',true,false,true,false),
('10091674667','QUEVEDO DE LA CRUZ ISAIAS JESÚS',false,false,false,true),
('10215256231','RADIADORES TROPICAL',false,false,false,true),
('20607863327','SER BIKER S.A.C',false,false,false,true),
('20565279239','SHINE WORKS S.A.C.',false,false,false,true),
('20607459411','SISTEMAS ELECTRONICOS ELECAM S.A.C. "ELECAM"',false,false,false,true),
('20607512231','SMC TIRES S.A.C',false,false,false,true),
('20128967606','SOCOPUR S.A.C.',false,false,true,false),
('20600351541','SOLUCIONES MÉDICAS TECNOLÓGICAS EIRL',false,false,false,true),
('20613392824','SPAZIO & SERVICES S.A.C.S.',false,false,false,true),
('20515513389','SPORTWAGEN S.AC',false,false,false,true),
('20117779379','SUMINISTROS TECNOLOGICOS S.A.C "SUMTEC"',false,false,true,false),
('20551526161','SYSTEMBASE TELECOMUNICACIONES E.I.R.L',false,false,false,true),
('15604304161','TARAZONA FRANCISCO ROBERTO CARLOS',false,false,false,true),
('20600159527','TCA INGENIEROS S. A. C.',true,false,false,false),
('20606191988','TGA SAC',false,false,false,true),
('20556566730','THIAMA SOCIEDAD ANONIMA CERRADA - THIAMA S.A.C.',false,false,false,true),
('20547892039','TIZIANNI PERU S. A.',false,false,false,true),
('20563874041','TUPAY INVERSIONES E.I.R.L.',false,false,false,true),
('20612247031','VALTAR SECURITY SYSTEM S.A.C.',false,false,false,true),
('10703244161','VASQUEZ GUTIERREZ JUNNIOR PAUL',false,false,false,true),
('20611277530','VELOZ GRUA EIRL',false,false,false,true),
('20602918077','VOLTEL S.A.C.',false,false,false,true),
('20601135893','W & J TOOLS AND SERVICE S.A.C.',false,false,false,true),
('10181522629','WILDER YONEL CRUZADO FERNANDEZ',false,false,false,true);

update proveedores p
   set buen_contribuyente = c.bc,
       agente_percepcion  = c.ap,
       agente_retencion   = c.ar,
       sujeto_retencion   = c.ret,
       modificado_en      = now()
  from cond_conta c
 where p.ruc = c.ruc;

create temp table ctas_conta (ruc text, banco text, moneda text, cuenta text, cci text);
insert into ctas_conta values
('10067848140','BBVA (GASTOS NOTARIALES)','Soles','001100500200147904',''),
('20611277530','BCP','Soles','1949982165047','00219400998216504792'),
('20608659425','BCP','Soles','193-9886859-0-59','002-193-009886859059-11'),
('20608659425','INTERBANK','Soles','200-3003756-6-27','003-200003003756627-37'),
('20608659425','INTERBANK','Dólares','200-3006119-3-33','003-200-003006119333-37'),
('10067461482','BCP','Soles','19336051952012','00219313605195201213'),
('10091674667','BBVA','Soles','0011-0169-0200381238',''),
('10257202475','BBVA','Soles','0011-0814-0241192348','01181400024119234811'),
('10466239467','BCP','Soles','19172841018084','00219117284101808453'),
('10703244161','BBVA','Soles','0011-0814-0216521698','0011-0814-0216521698'),
('20536675621','BBVA','Soles','0011-0384-01-00033061','01138400010003306151'),
('20536675621','BBVA','Dólares','011-0384-01-00033088','01138400010003308854'),
('20549672338','BCP','Soles','194-2173232-037','002-194-002173232037-95'),
('20551526161','BBVA','Dólares','00110286010002059523','01128600010002059523'),
('20551526161','DETRACCIONES BN','Dólares','00-098-149678',''),
('20551701698','BCP','Soles','1938037832020','00219300803783202016'),
('20551701698','DETRACCIONES BN','Soles','00099122498','-'),
('20553008795','BCP','Soles','193-2088085-0-66','002-193-002088085066-12'),
('20553008795','BCP','Dólares','193-2091468-1-47','002-193-002091468147-11'),
('20600159527','BBVA','Soles','0011-0120-0200262169-32','011-120-000200262169-32'),
('20600159527','DETRACCIONES BN','Soles','00024083500','-'),
('20602292801','BCP','Soles','19191034572011','00219119103457201153'),
('20606600985','BCP','Soles','1947227826041','00219400722782604198'),
('20609123720','BCP','Soles','1929860470005','00219200986047000538'),
('20609123720','BCP','Dólares','1917032224174','00219100703222417459'),
('20610215018','INTERBANK','Soles','561-3005015467','003-561-003005015467-80'),
('20613392824','BBVA','Soles','0011-01420201156680','011-142-000201156680-75'),
('20468450217','BBVA','Soles','00110197010001201718',''),
('20606191988','BCP','Soles','1942657354058','00219400265735405895'),
('20554916407','BCP','Soles','1942240947026','00219400224094702691'),
('10067848140','BBVA (GASTOS REGISTRALES)','Soles','001108140225359852',''),
('10100045597','BBVA','Soles','001108140213037779',''),
('20603142544','BCP','Soles','19393878405069','00219319387840506912'),
('20330096749','BBVA','Dólares','00110191430100047632',''),
('20128967606','BBVA','Soles','306-81-0100001121','011-306-000100001121-81'),
('20128967606','BBVA','Dólares','306-83-0100015971','011-306-000100015971-83'),
('20607459411','INTERBANK','Soles','0943003309551','00309400300330955101'),
('20565279239','BBVA','Soles','001105180100007424',''),
('20100084768','BBVA','Soles','001109100100004183',''),
('20100084768','BBVA','Dólares','001109100100011309',''),
('20612247031','BBVA','Soles','00110112030200393693','01111200020039369303'),
('10467012547','BBVA','Soles','001108420200259252',''),
('20502654048','BCP','Soles','1941948746001','00219400194874600196'),
('10455864980','BCP','Soles','19133251950027','00219113325195002752'),
('20555187859','BCP','Soles','1932124251080','00219300212425108014'),
('20604767092','BBVA','Soles','0011003410100042929',''),
('20515513389','BBVA','Soles','001107160100009105',''),
('20600297148','BBVA','Dólares','001109100100163729',''),
('20563874041','BCP','Soles','2852092738052','00228500209273805255'),
('20605674136','BCP','Soles','1932608242078','00219300260824207812'),
('10181522629','BCP','Soles','57039587005027','00257013958700502708'),
('15604304161','BCP','Soles','19105090483001','0021911059048300159'),
('20604158657','DETRACCIONES BN','Soles','00512103790',''),
('10067461482','DETRACCIONES BN','Soles','00002160803',''),
('10406430711','BBVA','Soles','001101750200836572',''),
('10063187483','BCP','Soles','19492625348055','00219419262534805597'),
('20454742321','DETRACCIONES BN','Soles','0010176048',''),
('20605827803','DETRACCIONES BN','Soles','00101686264',''),
('20606076127','BCP','Dólares','1939296430141','00219300929643014117'),
('20556566730','INTERBANK','Soles','2003006306428','00320000300630642838'),
('20117779379','BBVA','Dólares','001109100100086317','01191000010008631773'),
('20601762219','BBVA','Dólares','001101850100027981','01118500010002798168'),
('20330096749','BCP','Dólares','1941518677180',''),
('20548660034','BBVA','Soles','001101780100082100',''),
('10419692382','BBVA','Soles','00101630200217567',''),
('20600137094','BBVA','Dólares','001101760100063555','1117600010006355555'),
('20607086185','BBVA (RECAUDO: 17617)','Dólares','00110910010017702974','01191000010017702974'),
('20297867718','BBVA','Dólares','001103470100018346','01134700010001834625'),
('10215256231','BCP','Soles','38020061314016','00238012006131401644'),
('20612434434','INTERBANK','Soles','0000','00348200300611426772'),
('20612434434','DETRACCIONES BN','Soles','00014169008','000000'),
('20454742321','BCP','Soles','215-9848309-0-83','00221500984830908327'),
('20454742321','DETRACCIÓN BANCO DE LA NACIÓN','Soles','0010176048','0'),
('15608248436','BBVA','Soles','001101350201118233',''),
('20547892039','BBVA','Soles','001101780100053208',''),
('20604158657','BCP','Soles','4802680612071','00248000268061207128'),
('20318171701','BBVA','Soles','001102320100047065','01123200010004706566'),
('10416630157','BCP','Soles','40500369648069','00240510036964806991'),
('15613345148','BCP','Soles','19402537160086','00219410253716008693'),
('20552919344','BCP','Soles','1912088450053','00219100208845005357'),
('20552919344','BCP','Dólares','1912051069177','00219100205106917755'),
('20552919344','DETRACCIÓN BANCO DE LA NACIÓN','Soles','00023026767','0000'),
('20601952751','BBVA','Soles','001107910100030979',''),
('20603768168','BCP','Soles','1912587485010','00219100258748501057'),
('20600184777','BBVA','Soles','001101600200270542','011016000020027054290'),
('10720897275','BCP S/','Soles','19197238558063','00219119723855806353'),
('10075142914','BCP','Soles','19124455861088','00219112445586108850'),
('10067461482','BCP','Soles','19336051952012','00219313605195201213'),
('20454742321','BCP','Soles','215-9848309-0-83','00221500984830908327'),
('20600351541','BCP','Soles','001107510100008487','00110751590100008487'),
('20612282375','SCOTIABANK','Soles','0003895365','009-056-000003895365-39'),
('20612282375','BCP','Soles','193-4199974-0-77','00219300419997407716'),
('20612282375','BBVA','Soles','0011-0341-01-00056075','011-341-000100056075-53'),
('10105603687','BBVA','Soles','001101310200421526',''),
('20507115102','SCOTIABANK','Dólares','0004071621','00928000000407162199'),
('20117779379','BBVA','Soles','001109100100086309','01191000010008630970'),
('20453919651','BBVA (RECAUDADORA)','Dólares','960',''),
('20453919651','BBVA (RECAUDADORA)','Soles','9494',''),
('20453919651','BBVA','Dólares','001102390100018543',''),
('20611591731','BCP','Soles','1917106115038','00219100710611503850'),
('20601135893','BCP','Soles','1932436044004','00219300243604400414'),
('20602750303','BCP','Soles','39040195905096','00239014019590509633'),
('20605827803','BCP','Soles','21597619051096',''),
('20521730944','BCP','Soles','1911803784039','00219100180378403956'),
('10463104510','BBVA','Soles','001108140218080761','01181400021808076118'),
('20318171701','BCP','Soles','5401187644047','00254000118764404737'),
('20407865112','BBVA','Dólares','001101110100039153',''),
('20493524179','BBVA','Soles','001103010100071858','01130100010007185893'),
('20520751140','DETRACCIONES BN','Soles','00058136778',''),
('20563707578','BBVA Dólares','Dólares','00110193010003139701','0'),
('20536675621','BBVA','Dólares','001103840100033088','01138400010003308854'),
('20520751140','BBVA','Soles','001105210200268280',''),
('20603957564','INTERBANK','Soles','2003001985149','00320000300198514939'),
('20100041520','BBVA','Soles','00110910730100010582',''),
('20609787903','SCOTIABANK','Dólares','5270741-000-07','009-097-000005270741-71'),
('20609787903','SCOTIABANK','Soles','4224567-000-01','009-097-000004224567-70'),
('20612376744','INTERBANK','Soles','0000','00320000300737666734'),
('10309536288','DETRACCIONES BN','Soles','00123001044',''),
('20379331042','INTERBANK','Soles','00304100300136311512','0'),
('20454742321','BCP','Soles','2159848309083','00221500984830908327'),
('20602918077','BCP','Soles','19116600745028','00219111660074502000'),
('20610349502','BCP','Soles','1939905476011','00219300990547601113'),
('20553404631','BBVA','Dólares','001101130100069843','01111300010006984389'),
('20607512231','BBVA','Soles','00110352020046762526',''),
('10309536288','BCP','Soles','21597102926059','00221519710292605924'),
('107345501536','BBVA','Soles','001101310200421526','001101310200421526'),
('10419673540','Banco de la Nación','Soles','04-727-866545','018-727-004727866545-81');

-- Solo cuentas con número real (no "0000") que el ERP aún no tenga.
with limpias as (
  select c.ruc, c.banco, c.moneda,
         regexp_replace(c.cuenta, '[^0-9]', '', 'g') as cuenta_d,
         case when length(regexp_replace(coalesce(c.cci, ''), '[^0-9]', '', 'g')) >= 18
              then regexp_replace(c.cci, '[^0-9]', '', 'g') else null end as cci_d
    from ctas_conta c
), nuevas as (
  select distinct p.id, l.banco, l.moneda, l.cuenta_d, l.cci_d
    from limpias l
    join proveedores p on p.ruc = l.ruc
   where length(l.cuenta_d) >= 5 and l.cuenta_d !~ '^0+$'
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p.cuentas_bancarias, '[]'::jsonb)) e
        where regexp_replace(coalesce(e->>'cuenta', ''), '[^0-9]', '', 'g') = l.cuenta_d)
), agrupadas as (
  select id, jsonb_agg(jsonb_build_object('nombre', banco, 'cuenta', cuenta_d, 'cci', cci_d, 'moneda', moneda, 'origen', 'contabilidad_2026-10')) as ctas
    from nuevas group by id
)
update proveedores p
   set cuentas_bancarias = coalesce(p.cuentas_bancarias, '[]'::jsonb) || a.ctas,
       modificado_en = now()
  from agrupadas a
 where p.id = a.id;

drop table if exists cond_conta;
drop table if exists ctas_conta;
