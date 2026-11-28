// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  verifyGrant
} from "./chunk-EGSVFMLE.js";
import {
  acceptAnswer
} from "./chunk-FDKHDNC2.js";
import {
  effectFor,
  evaluate,
  serverOf,
  sessionRules,
  toolAction
} from "./chunk-AMT4OSAU.js";
import {
  canonicalJson,
  maxBytesOf,
  methodAccounts,
  readInstalledManifest
} from "./chunk-YOSR7DZV.js";
import {
  checkOutput
} from "./chunk-UY2FWVSQ.js";
import {
  BUS_EVENTS,
  ERROR_CODES,
  GAP_REASONS,
  METHOD_CLASSES,
  OPENCODE_RANGE,
  PAGE,
  REFUSAL_REASONS,
  eventHash,
  hostInRange,
  isEventKindIn,
  ownerProblems,
  removalProblems,
  sourceNamespace,
  thumbnailUrlProblems
} from "./chunk-RUQH3YH7.js";
import {
  secretKinds
} from "./chunk-M7EFVHR5.js";
import {
  ACCOUNT_STATES,
  REASON_MAX,
  aliasProblem,
  isAlias
} from "./chunk-CCSPDV3H.js";
import {
  fromJSONSchema
} from "./chunk-AYJEC7Y2.js";

// src/conformance.ts
import { resolve } from "node:path";

// src/internal/conformance/report.ts
function finding(id, level, message, options = {}) {
  return {
    id,
    level,
    message,
    ...options.path === void 0 ? {} : { path: options.path },
    ...options.fix === void 0 ? {} : { fix: options.fix }
  };
}
var error = (id, message, options = {}) => finding(id, "error", message, options);
var warning = (id, message, options = {}) => finding(id, "warning", message, options);
function isOk(findings) {
  return findings.every((entry) => entry.level !== "error");
}

// src/internal/conformance/accounts.ts
var CURSOR_CODES = ["CURSOR_INVALID", "ACCOUNT_MISMATCH"];
function accountFindings(manifest, recorded, options = {}) {
  const findings = [];
  const name = manifest.plugin.name;
  const aliases = recorded?.aliases ?? [];
  const cursorBearing = manifest.sources.some((source) => source.kind === "events");
  if (manifest.accounts === void 0) {
    if (aliases.length > 0) {
      findings.push(error("accounts.undeclared", `the fixture records the accounts ${aliases.join(", ")}, and capabilities declares no accounts`, { path: "capabilities.accounts", fix: "Remove the accounts block, or declare how they are held." }));
    }
    for (const [method, item] of Object.entries(manifest.methods)) {
      if (methodAccounts(item) !== "optional") continue;
      findings.push(warning("accounts.undeclared", `${method} takes an account, and the plugin declares no accounts`, { path: `capabilities.methods.${method}.accounts`, fix: "Declare accounts, or set the method's accounts to none." }));
    }
    return findings;
  }
  if (recorded === void 0) {
    findings.push(
      options.record === true ? warning("accounts.recorded", `${name} declares accounts and records no two-account behaviour yet`, { path: "fixtures/conformance.json" }) : error("accounts.recorded", `${name} declares accounts and records no two-account behaviour`, {
        path: "fixtures/conformance.json",
        fix: cursorBearing ? "Record two aliases with ACCOUNT_REQUIRED, ACCOUNT_UNKNOWN and a cursor that another account may not use." : "Record two aliases with ACCOUNT_REQUIRED and ACCOUNT_UNKNOWN."
      })
    );
    return findings;
  }
  if (aliases.length < 2) {
    findings.push(error("accounts.aliases", `${name} declares accounts and the fixture records ${aliases.length === 0 ? "none" : `one alias (${aliases[0]})`}: several accounts are the contract's promise`, { path: "fixtures/conformance.json", fix: "Record at least two aliases, such as work and personal." }));
  }
  const seen = /* @__PURE__ */ new Set();
  for (const alias of aliases) {
    const problem = aliasProblem(alias, `the alias "${String(alias)}"`);
    if (problem !== void 0) findings.push(error("accounts.aliases", problem, { path: "fixtures/conformance.json" }));
    if (seen.has(alias)) findings.push(error("accounts.aliases", `the fixture records the alias ${alias} twice`, { path: "fixtures/conformance.json" }));
    seen.add(alias);
    const server = serverOf(name, alias, aliases);
    if (!server.ok) findings.push(error("accounts.names", `${alias} derives no integration or MCP server name: ${server.problems.join("; ")}`, { path: "fixtures/conformance.json" }));
  }
  if (manifest.accounts.via === "local" && aliases.length > 1) {
    findings.push(error("accounts.local", `${name} holds accounts as the machine's identity, and the fixture records ${aliases.length} aliases: a local plugin has one account`, { path: "capabilities.accounts.via" }));
  }
  const required = recorded.required;
  if (required === void 0) {
    findings.push(error("accounts.required", "the fixture records no ACCOUNT_REQUIRED case: with two aliases and no account, a call is refused", { path: "fixtures/conformance.json" }));
  } else {
    if (required.code !== "ACCOUNT_REQUIRED") findings.push(error("accounts.required", `the required-account case answers ${String(required.code)}, not ACCOUNT_REQUIRED`, { path: "fixtures/conformance.json" }));
    const method = typeof required.method === "string" ? required.method : "";
    if (method === "" || manifest.methods[method] === void 0) findings.push(error("accounts.required", `the required-account case names ${String(required.method)}, which is not a declared method`, { path: "fixtures/conformance.json" }));
    else if (methodAccounts(manifest.methods[method]) !== "optional") findings.push(error("accounts.required", `${method} does not take an account, so it cannot ask for one`, { path: `capabilities.methods.${method}.accounts` }));
  }
  const unknown = recorded.unknown;
  if (unknown === void 0) {
    findings.push(error("accounts.unknown", "the fixture records no ACCOUNT_UNKNOWN case: an alias the plugin does not serve is refused", { path: "fixtures/conformance.json" }));
  } else {
    if (unknown.code !== "ACCOUNT_UNKNOWN") findings.push(error("accounts.unknown", `the unknown-account case answers ${String(unknown.code)}, not ACCOUNT_UNKNOWN`, { path: "fixtures/conformance.json" }));
    if (typeof unknown.account !== "string" || isAlias(unknown.account) === false) findings.push(error("accounts.unknown", `the unknown-account case names ${String(unknown.account)}, which is not an alias`, { path: "fixtures/conformance.json" }));
    else if (aliases.includes(unknown.account)) findings.push(error("accounts.unknown", `the unknown-account case names ${unknown.account}, and the fixture records it as an alias`, { path: "fixtures/conformance.json" }));
    const method = typeof unknown.method === "string" ? unknown.method : "";
    if (method === "" || manifest.methods[method] === void 0) findings.push(error("accounts.unknown", `the unknown-account case names ${String(unknown.method)}, which is not a declared method`, { path: "fixtures/conformance.json" }));
  }
  const cursors = recorded.cursors ?? [];
  if (cursorBearing && cursors.length === 0) {
    findings.push(error("accounts.cursors", "the fixture records no cursor another account may not use: a cursor is bound to its account", { path: "fixtures/conformance.json", fix: "Record one page under two aliases, and the CURSOR_INVALID refusal for the other." }));
  }
  for (const [index, cursor] of cursors.entries()) {
    const at = `cursors[${index}]`;
    if (typeof cursor.account !== "string" || !aliases.includes(cursor.account)) findings.push(error("accounts.cursors", `${at} names ${String(cursor.account)}, which is not a recorded alias`, { path: "fixtures/conformance.json" }));
    if (typeof cursor.other !== "string" || !aliases.includes(cursor.other)) findings.push(error("accounts.cursors", `${at} reads under ${String(cursor.other)}, which is not a recorded alias`, { path: "fixtures/conformance.json" }));
    if (cursor.account === cursor.other) findings.push(error("accounts.cursors", `${at} reads under the same account that issued the cursor`, { path: "fixtures/conformance.json" }));
    if (!CURSOR_CODES.includes(cursor.code)) findings.push(error("accounts.cursors", `${at} answers ${String(cursor.code)}, not ${CURSOR_CODES.join(" or ")}`, { path: "fixtures/conformance.json" }));
    const method = typeof cursor.method === "string" ? cursor.method : "";
    if (method === "" || manifest.methods[method] === void 0) findings.push(error("accounts.cursors", `${at} names ${String(cursor.method)}, which is not a declared method`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}

// src/internal/conformance/actions.ts
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var PREVIEW_KEYS = ["output", "reaches", "changes", "cost", "trust"];
function actionFindings(manifest, recorded, options = {}) {
  const findings = [];
  const byId = new Map((recorded ?? []).map((entry) => [entry.id, entry]));
  for (const entry of recorded ?? []) {
    if (manifest.actions.some((action) => action.id === entry.id)) continue;
    findings.push(error("actions.declared", `the fixture records the action ${entry.id}, which capabilities.actions does not declare`, { path: "fixtures/conformance.json" }));
  }
  for (const action of manifest.actions) {
    if (action.effect === "local") continue;
    const recording = byId.get(action.id);
    if (recording?.preview?.answer === void 0) {
      findings.push(
        options.record === true ? warning("actions.recorded", `${action.id} records no preview yet`, { path: "fixtures/conformance.json" }) : error("actions.recorded", `${action.id} records no preview, so nothing shows what its preview answers`, {
          path: "fixtures/conformance.json",
          fix: "Record the preview and the commit with plugin-kit record."
        })
      );
      continue;
    }
    const answer = recording.preview.answer;
    if (!plain(answer)) {
      findings.push(error("actions.preview", `${action.id}'s preview answer is not an object`, { path: "fixtures/conformance.json" }));
      continue;
    }
    for (const key of Object.keys(answer)) if (!PREVIEW_KEYS.includes(key)) findings.push(error("actions.preview", `${action.id}'s preview carries ${key}, which \xA78 does not define`, { path: "fixtures/conformance.json" }));
    if (!Object.hasOwn(answer, "output")) findings.push(error("actions.preview", `${action.id}'s preview carries no output`, { path: "fixtures/conformance.json" }));
    if (answer["trust"] !== "untrusted") findings.push(error("actions.preview", `${action.id}'s preview trust must be "untrusted"`, { path: "fixtures/conformance.json" }));
    if (recording.commit?.answer === void 0) {
      findings.push(
        options.record === true ? warning("actions.recorded", `${action.id} records no commit yet`, { path: "fixtures/conformance.json" }) : error("actions.recorded", `${action.id} records no commit, so the confirm-then-commit flow is not proven`, { path: "fixtures/conformance.json" })
      );
    }
  }
  return findings;
}

// src/internal/conformance/public-suffix-list.ts
var RULES = `ac
com.ac
edu.ac
gov.ac
mil.ac
net.ac
org.ac
ad
ae
ac.ae
co.ae
gov.ae
mil.ae
net.ae
org.ae
sch.ae
aero
airline.aero
airport.aero
accident-investigation.aero
accident-prevention.aero
aerobatic.aero
aeroclub.aero
aerodrome.aero
agents.aero
air-surveillance.aero
air-traffic-control.aero
aircraft.aero
airtraffic.aero
ambulance.aero
association.aero
author.aero
ballooning.aero
broker.aero
caa.aero
cargo.aero
catering.aero
certification.aero
championship.aero
charter.aero
civilaviation.aero
club.aero
conference.aero
consultant.aero
consulting.aero
control.aero
council.aero
crew.aero
design.aero
dgca.aero
educator.aero
emergency.aero
engine.aero
engineer.aero
entertainment.aero
equipment.aero
exchange.aero
express.aero
federation.aero
flight.aero
freight.aero
fuel.aero
gliding.aero
government.aero
groundhandling.aero
group.aero
hanggliding.aero
homebuilt.aero
insurance.aero
journal.aero
journalist.aero
leasing.aero
logistics.aero
magazine.aero
maintenance.aero
marketplace.aero
media.aero
microlight.aero
modelling.aero
navigation.aero
parachuting.aero
paragliding.aero
passenger-association.aero
pilot.aero
press.aero
production.aero
recreation.aero
repbody.aero
res.aero
research.aero
rotorcraft.aero
safety.aero
scientist.aero
services.aero
show.aero
skydiving.aero
software.aero
student.aero
taxi.aero
trader.aero
trading.aero
trainer.aero
union.aero
workinggroup.aero
works.aero
af
com.af
edu.af
gov.af
net.af
org.af
ag
co.ag
com.ag
net.ag
nom.ag
org.ag
ai
com.ai
net.ai
off.ai
org.ai
al
com.al
edu.al
gov.al
mil.al
net.al
org.al
am
co.am
com.am
commune.am
net.am
org.am
ao
co.ao
ed.ao
edu.ao
gov.ao
gv.ao
it.ao
og.ao
org.ao
pb.ao
aq
ar
bet.ar
com.ar
coop.ar
edu.ar
gob.ar
gov.ar
int.ar
mil.ar
musica.ar
mutual.ar
net.ar
org.ar
seg.ar
senasa.ar
tur.ar
arpa
e164.arpa
home.arpa
in-addr.arpa
ip6.arpa
iris.arpa
uri.arpa
urn.arpa
as
gov.as
asia
at
ac.at
sth.ac.at
co.at
gv.at
or.at
au
asn.au
com.au
edu.au
gov.au
id.au
net.au
org.au
conf.au
oz.au
act.au
nsw.au
nt.au
qld.au
sa.au
tas.au
vic.au
wa.au
act.edu.au
catholic.edu.au
nsw.edu.au
nt.edu.au
qld.edu.au
sa.edu.au
tas.edu.au
vic.edu.au
wa.edu.au
qld.gov.au
sa.gov.au
tas.gov.au
vic.gov.au
wa.gov.au
aw
com.aw
ax
az
biz.az
co.az
com.az
edu.az
gov.az
info.az
int.az
mil.az
name.az
net.az
org.az
pp.az
pro.az
ba
com.ba
edu.ba
gov.ba
mil.ba
net.ba
org.ba
bb
biz.bb
co.bb
com.bb
edu.bb
gov.bb
info.bb
net.bb
org.bb
store.bb
tv.bb
bd
ac.bd
ai.bd
co.bd
com.bd
edu.bd
gov.bd
id.bd
info.bd
it.bd
mil.bd
net.bd
org.bd
sch.bd
tv.bd
be
ac.be
bf
gov.bf
bg
0.bg
1.bg
2.bg
3.bg
4.bg
5.bg
6.bg
7.bg
8.bg
9.bg
a.bg
b.bg
c.bg
d.bg
e.bg
f.bg
g.bg
h.bg
i.bg
j.bg
k.bg
l.bg
m.bg
n.bg
o.bg
p.bg
q.bg
r.bg
s.bg
t.bg
u.bg
v.bg
w.bg
x.bg
y.bg
z.bg
bh
com.bh
edu.bh
gov.bh
net.bh
org.bh
bi
co.bi
com.bi
edu.bi
or.bi
org.bi
biz
bj
africa.bj
agro.bj
architectes.bj
assur.bj
avocats.bj
co.bj
com.bj
eco.bj
econo.bj
edu.bj
info.bj
loisirs.bj
money.bj
net.bj
org.bj
ote.bj
restaurant.bj
resto.bj
tourism.bj
univ.bj
bm
com.bm
edu.bm
gov.bm
net.bm
org.bm
bn
com.bn
edu.bn
gov.bn
net.bn
org.bn
bo
com.bo
edu.bo
gob.bo
int.bo
mil.bo
net.bo
org.bo
tv.bo
web.bo
academia.bo
agro.bo
arte.bo
blog.bo
bolivia.bo
ciencia.bo
cooperativa.bo
democracia.bo
deporte.bo
ecologia.bo
economia.bo
empresa.bo
ia.bo
indigena.bo
industria.bo
info.bo
medicina.bo
movimiento.bo
musica.bo
natural.bo
nombre.bo
noticias.bo
patria.bo
plurinacional.bo
politica.bo
profesional.bo
pueblo.bo
revista.bo
salud.bo
tecnologia.bo
tksat.bo
transporte.bo
wiki.bo
br
9guacu.br
abc.br
adm.br
adv.br
agr.br
aju.br
am.br
anani.br
aparecida.br
api.br
app.br
arq.br
art.br
ato.br
b.br
barueri.br
belem.br
bet.br
bhz.br
bib.br
bio.br
blog.br
bmd.br
boavista.br
bsb.br
campinagrande.br
campinas.br
caxias.br
cim.br
cng.br
cnt.br
com.br
contagem.br
coop.br
coz.br
cri.br
cuiaba.br
curitiba.br
def.br
des.br
det.br
dev.br
ecn.br
eco.br
edu.br
emp.br
enf.br
eng.br
esp.br
etc.br
eti.br
far.br
feira.br
flog.br
floripa.br
fm.br
fnd.br
fortal.br
fot.br
foz.br
fst.br
g12.br
geo.br
ggf.br
goiania.br
gov.br
ac.gov.br
al.gov.br
am.gov.br
ap.gov.br
ba.gov.br
ce.gov.br
df.gov.br
es.gov.br
go.gov.br
ma.gov.br
mg.gov.br
ms.gov.br
mt.gov.br
pa.gov.br
pb.gov.br
pe.gov.br
pi.gov.br
pr.gov.br
rj.gov.br
rn.gov.br
ro.gov.br
rr.gov.br
rs.gov.br
sc.gov.br
se.gov.br
sp.gov.br
to.gov.br
gru.br
ia.br
imb.br
ind.br
inf.br
jab.br
jampa.br
jdf.br
joinville.br
jor.br
jus.br
leg.br
leilao.br
lel.br
log.br
londrina.br
macapa.br
maceio.br
manaus.br
maringa.br
mat.br
med.br
mil.br
morena.br
mp.br
mus.br
natal.br
net.br
niteroi.br
*.nom.br
not.br
ntr.br
odo.br
ong.br
org.br
osasco.br
palmas.br
poa.br
ppg.br
pro.br
psc.br
psi.br
pvh.br
qsl.br
radio.br
rec.br
recife.br
rep.br
ribeirao.br
rio.br
riobranco.br
riopreto.br
salvador.br
sampa.br
santamaria.br
santoandre.br
saobernardo.br
saogonca.br
seg.br
sjc.br
slg.br
slz.br
social.br
sorocaba.br
srv.br
taxi.br
tc.br
tec.br
teo.br
the.br
tmp.br
trd.br
tur.br
tv.br
udi.br
vet.br
vix.br
vlog.br
wiki.br
xyz.br
zlg.br
bs
com.bs
edu.bs
gov.bs
net.bs
org.bs
bt
com.bt
edu.bt
gov.bt
net.bt
org.bt
bv
bw
ac.bw
co.bw
gov.bw
net.bw
org.bw
by
gov.by
mil.by
com.by
of.by
bz
co.bz
com.bz
edu.bz
gov.bz
net.bz
org.bz
ca
ab.ca
bc.ca
mb.ca
nb.ca
nf.ca
nl.ca
ns.ca
nt.ca
nu.ca
on.ca
pe.ca
qc.ca
sk.ca
yk.ca
gc.ca
cat
cc
cd
gov.cd
cf
cg
ch
ci
ac.ci
a\xE9roport.ci
asso.ci
co.ci
com.ci
ed.ci
edu.ci
go.ci
gouv.ci
int.ci
net.ci
or.ci
org.ci
*.ck
!www.ck
cl
co.cl
gob.cl
gov.cl
mil.cl
cm
co.cm
com.cm
gov.cm
net.cm
cn
ac.cn
com.cn
edu.cn
gov.cn
mil.cn
net.cn
org.cn
\u516C\u53F8.cn
\u7DB2\u7D61.cn
\u7F51\u7EDC.cn
ah.cn
bj.cn
cq.cn
fj.cn
gd.cn
gs.cn
gx.cn
gz.cn
ha.cn
hb.cn
he.cn
hi.cn
hk.cn
hl.cn
hn.cn
jl.cn
js.cn
jx.cn
ln.cn
mo.cn
nm.cn
nx.cn
qh.cn
sc.cn
sd.cn
sh.cn
sn.cn
sx.cn
tj.cn
tw.cn
xj.cn
xz.cn
yn.cn
zj.cn
co
com.co
edu.co
gov.co
mil.co
net.co
nom.co
org.co
com
coop
cr
ac.cr
co.cr
ed.cr
fi.cr
go.cr
or.cr
sa.cr
cu
com.cu
edu.cu
gob.cu
inf.cu
nat.cu
net.cu
org.cu
cv
com.cv
edu.cv
id.cv
int.cv
net.cv
nome.cv
org.cv
publ.cv
cw
com.cw
edu.cw
net.cw
org.cw
cx
gov.cx
cy
ac.cy
biz.cy
com.cy
ekloges.cy
gov.cy
ltd.cy
mil.cy
net.cy
org.cy
press.cy
pro.cy
tm.cy
cz
gov.cz
de
dj
dk
dm
co.dm
com.dm
edu.dm
gov.dm
net.dm
org.dm
do
art.do
com.do
edu.do
gob.do
gov.do
mil.do
net.do
org.do
sld.do
web.do
dz
art.dz
asso.dz
com.dz
edu.dz
gov.dz
net.dz
org.dz
pol.dz
soc.dz
tm.dz
ec
abg.ec
adm.ec
agron.ec
arqt.ec
art.ec
bar.ec
chef.ec
com.ec
cont.ec
cpa.ec
cue.ec
dent.ec
dgn.ec
disco.ec
doc.ec
edu.ec
eng.ec
esm.ec
fin.ec
fot.ec
gal.ec
gob.ec
gov.ec
gye.ec
ibr.ec
info.ec
k12.ec
lat.ec
loj.ec
med.ec
mil.ec
mktg.ec
mon.ec
net.ec
ntr.ec
odont.ec
org.ec
pro.ec
prof.ec
psic.ec
psiq.ec
pub.ec
rio.ec
rrpp.ec
sal.ec
tech.ec
tul.ec
tur.ec
uio.ec
vet.ec
xxx.ec
edu
ee
aip.ee
com.ee
edu.ee
fie.ee
gov.ee
lib.ee
med.ee
org.ee
pri.ee
riik.ee
eg
ac.eg
com.eg
edu.eg
eun.eg
gov.eg
info.eg
me.eg
mil.eg
name.eg
net.eg
org.eg
sci.eg
sport.eg
tv.eg
*.er
es
com.es
edu.es
gob.es
nom.es
org.es
et
biz.et
com.et
edu.et
gov.et
info.et
name.et
net.et
org.et
eu
fi
aland.fi
fj
ac.fj
biz.fj
com.fj
edu.fj
gov.fj
id.fj
info.fj
mil.fj
name.fj
net.fj
org.fj
pro.fj
*.fk
fm
com.fm
edu.fm
net.fm
org.fm
fo
fr
asso.fr
com.fr
gouv.fr
nom.fr
prd.fr
tm.fr
avoues.fr
cci.fr
greta.fr
huissier-justice.fr
ga
gb
gd
edu.gd
gov.gd
ge
com.ge
cyb.ge
edu.ge
gov.ge
llc.ge
net.ge
online.ge
org.ge
pvt.ge
school.ge
tnx.ge
gf
gg
co.gg
net.gg
org.gg
gh
biz.gh
com.gh
edu.gh
gov.gh
mil.gh
net.gh
org.gh
gi
com.gi
edu.gi
gov.gi
ltd.gi
mod.gi
org.gi
gl
co.gl
com.gl
edu.gl
net.gl
org.gl
gm
gn
ac.gn
com.gn
edu.gn
gov.gn
net.gn
org.gn
gov
gp
asso.gp
com.gp
edu.gp
mobi.gp
net.gp
org.gp
gq
gr
com.gr
edu.gr
gov.gr
net.gr
org.gr
gs
gt
com.gt
edu.gt
gob.gt
ind.gt
mil.gt
net.gt
org.gt
gu
com.gu
edu.gu
gov.gu
guam.gu
info.gu
net.gu
org.gu
web.gu
gw
gy
co.gy
com.gy
edu.gy
gov.gy
net.gy
org.gy
hk
com.hk
edu.hk
gov.hk
idv.hk
net.hk
org.hk
\u4E2A\u4EBA.hk
\u500B\u4EBA.hk
\u516C\u53F8.hk
\u653F\u5E9C.hk
\u654E\u80B2.hk
\u6559\u80B2.hk
\u7B87\u4EBA.hk
\u7D44\u7E54.hk
\u7D44\u7EC7.hk
\u7DB2\u7D61.hk
\u7DB2\u7EDC.hk
\u7EC4\u7E54.hk
\u7EC4\u7EC7.hk
\u7F51\u7D61.hk
\u7F51\u7EDC.hk
hm
hn
com.hn
edu.hn
gob.hn
mil.hn
net.hn
org.hn
hr
com.hr
from.hr
iz.hr
name.hr
ht
adult.ht
art.ht
asso.ht
com.ht
coop.ht
edu.ht
firm.ht
gouv.ht
info.ht
med.ht
net.ht
org.ht
perso.ht
pol.ht
pro.ht
rel.ht
shop.ht
hu
2000.hu
agrar.hu
bolt.hu
casino.hu
city.hu
co.hu
erotica.hu
erotika.hu
film.hu
forum.hu
games.hu
hotel.hu
info.hu
ingatlan.hu
jogasz.hu
konyvelo.hu
lakas.hu
media.hu
news.hu
org.hu
priv.hu
reklam.hu
sex.hu
shop.hu
sport.hu
suli.hu
szex.hu
tm.hu
tozsde.hu
utazas.hu
video.hu
id
ac.id
ai.id
biz.id
co.id
desa.id
go.id
kop.id
mil.id
my.id
net.id
or.id
ponpes.id
sch.id
web.id
\u1B29\u1B2E\u1B36.id
ie
gov.ie
il
ac.il
co.il
gov.il
idf.il
k12.il
muni.il
net.il
org.il
\u05D9\u05E9\u05E8\u05D0\u05DC
\u05D0\u05E7\u05D3\u05DE\u05D9\u05D4.\u05D9\u05E9\u05E8\u05D0\u05DC
\u05D9\u05E9\u05D5\u05D1.\u05D9\u05E9\u05E8\u05D0\u05DC
\u05E6\u05D4\u05DC.\u05D9\u05E9\u05E8\u05D0\u05DC
\u05DE\u05DE\u05E9\u05DC.\u05D9\u05E9\u05E8\u05D0\u05DC
im
ac.im
co.im
ltd.co.im
plc.co.im
com.im
net.im
org.im
tt.im
tv.im
in
5g.in
6g.in
ac.in
aero.in
ai.in
alumni.in
am.in
bank.in
bihar.in
biz.in
business.in
ca.in
cn.in
co.in
com.in
coop.in
cs.in
delhi.in
dr.in
edu.in
er.in
fin.in
firm.in
gen.in
gov.in
gujarat.in
ind.in
info.in
int.in
internet.in
io.in
me.in
mil.in
net.in
nic.in
org.in
pg.in
post.in
pro.in
res.in
school.in
travel.in
tv.in
ub.in
uk.in
up.in
us.in
info
int
eu.int
io
co.io
com.io
edu.io
gov.io
mil.io
net.io
nom.io
org.io
iq
com.iq
edu.iq
gov.iq
mil.iq
net.iq
org.iq
ir
ac.ir
co.ir
gov.ir
id.ir
net.ir
org.ir
sch.ir
\u0627\u06CC\u0631\u0627\u0646.ir
\u0627\u064A\u0631\u0627\u0646.ir
is
it
edu.it
gov.it
abr.it
abruzzo.it
aosta-valley.it
aostavalley.it
bas.it
basilicata.it
cal.it
calabria.it
cam.it
campania.it
emilia-romagna.it
emiliaromagna.it
emr.it
friuli-v-giulia.it
friuli-ve-giulia.it
friuli-vegiulia.it
friuli-venezia-giulia.it
friuli-veneziagiulia.it
friuli-vgiulia.it
friuliv-giulia.it
friulive-giulia.it
friulivegiulia.it
friulivenezia-giulia.it
friuliveneziagiulia.it
friulivgiulia.it
fvg.it
laz.it
lazio.it
lig.it
liguria.it
lom.it
lombardia.it
lombardy.it
lucania.it
mar.it
marche.it
mol.it
molise.it
piedmont.it
piemonte.it
pmn.it
pug.it
puglia.it
sar.it
sardegna.it
sardinia.it
sic.it
sicilia.it
sicily.it
taa.it
tos.it
toscana.it
trentin-sud-tirol.it
trentin-s\xFCd-tirol.it
trentin-sudtirol.it
trentin-s\xFCdtirol.it
trentin-sued-tirol.it
trentin-suedtirol.it
trentino-a-adige.it
trentino-aadige.it
trentino-alto-adige.it
trentino-altoadige.it
trentino-s-tirol.it
trentino-stirol.it
trentino-sud-tirol.it
trentino-s\xFCd-tirol.it
trentino-sudtirol.it
trentino-s\xFCdtirol.it
trentino-sued-tirol.it
trentino-suedtirol.it
trentinoa-adige.it
trentinoaadige.it
trentinoalto-adige.it
trentinoaltoadige.it
trentinos-tirol.it
trentinostirol.it
trentinosud-tirol.it
trentinos\xFCd-tirol.it
trentinos\xFCdtirol.it
trentinosued-tirol.it
trentinosuedtirol.it
trentinsud-tirol.it
trentins\xFCd-tirol.it
trentinsudtirol.it
trentins\xFCdtirol.it
trentinsued-tirol.it
trentinsuedtirol.it
tuscany.it
umb.it
umbria.it
val-d-aosta.it
val-daosta.it
vald-aosta.it
valle-aosta.it
valle-d-aosta.it
valle-daosta.it
valleaosta.it
valled-aosta.it
valledaosta.it
vallee-aoste.it
vall\xE9e-aoste.it
vallee-d-aoste.it
vall\xE9e-d-aoste.it
valleeaoste.it
vall\xE9eaoste.it
valleedaoste.it
vall\xE9edaoste.it
vao.it
vda.it
ven.it
veneto.it
ag.it
agrigento.it
al.it
alessandria.it
alto-adige.it
altoadige.it
an.it
ancona.it
andria-barletta-trani.it
andria-trani-barletta.it
andriabarlettatrani.it
andriatranibarletta.it
ao.it
aosta.it
aoste.it
ap.it
aq.it
ar.it
arezzo.it
ascoli-piceno.it
ascolipiceno.it
asti.it
at.it
av.it
avellino.it
ba.it
balsan.it
balsan-sudtirol.it
balsan-s\xFCdtirol.it
balsan-suedtirol.it
bari.it
barletta-trani-andria.it
barlettatraniandria.it
belluno.it
benevento.it
bergamo.it
bg.it
bi.it
biella.it
bl.it
bn.it
bo.it
bologna.it
bolzano.it
bolzano-altoadige.it
bozen.it
bozen-sudtirol.it
bozen-s\xFCdtirol.it
bozen-suedtirol.it
br.it
brescia.it
brindisi.it
bs.it
bt.it
bulsan.it
bulsan-sudtirol.it
bulsan-s\xFCdtirol.it
bulsan-suedtirol.it
bz.it
ca.it
cagliari.it
caltanissetta.it
campidano-medio.it
campidanomedio.it
campobasso.it
carbonia-iglesias.it
carboniaiglesias.it
carrara-massa.it
carraramassa.it
caserta.it
catania.it
catanzaro.it
cb.it
ce.it
cesena-forli.it
cesena-forl\xEC.it
cesenaforli.it
cesenaforl\xEC.it
ch.it
chieti.it
ci.it
cl.it
cn.it
co.it
como.it
cosenza.it
cr.it
cremona.it
crotone.it
cs.it
ct.it
cuneo.it
cz.it
dell-ogliastra.it
dellogliastra.it
en.it
enna.it
fc.it
fe.it
fermo.it
ferrara.it
fg.it
fi.it
firenze.it
florence.it
fm.it
foggia.it
forli-cesena.it
forl\xEC-cesena.it
forlicesena.it
forl\xECcesena.it
fr.it
frosinone.it
ge.it
genoa.it
genova.it
go.it
gorizia.it
gr.it
grosseto.it
iglesias-carbonia.it
iglesiascarbonia.it
im.it
imperia.it
is.it
isernia.it
kr.it
la-spezia.it
laquila.it
laspezia.it
latina.it
lc.it
le.it
lecce.it
lecco.it
li.it
livorno.it
lo.it
lodi.it
lt.it
lu.it
lucca.it
macerata.it
mantova.it
massa-carrara.it
massacarrara.it
matera.it
mb.it
mc.it
me.it
medio-campidano.it
mediocampidano.it
messina.it
mi.it
milan.it
milano.it
mn.it
mo.it
modena.it
monza.it
monza-brianza.it
monza-e-della-brianza.it
monzabrianza.it
monzaebrianza.it
monzaedellabrianza.it
ms.it
mt.it
na.it
naples.it
napoli.it
no.it
novara.it
nu.it
nuoro.it
og.it
ogliastra.it
olbia-tempio.it
olbiatempio.it
or.it
oristano.it
ot.it
pa.it
padova.it
padua.it
palermo.it
parma.it
pavia.it
pc.it
pd.it
pe.it
perugia.it
pesaro-urbino.it
pesarourbino.it
pescara.it
pg.it
pi.it
piacenza.it
pisa.it
pistoia.it
pn.it
po.it
pordenone.it
potenza.it
pr.it
prato.it
pt.it
pu.it
pv.it
pz.it
ra.it
ragusa.it
ravenna.it
rc.it
re.it
reggio-calabria.it
reggio-emilia.it
reggiocalabria.it
reggioemilia.it
rg.it
ri.it
rieti.it
rimini.it
rm.it
rn.it
ro.it
roma.it
rome.it
rovigo.it
sa.it
salerno.it
sassari.it
savona.it
si.it
siena.it
siracusa.it
so.it
sondrio.it
sp.it
sr.it
ss.it
su.it
sud-sardegna.it
sudsardegna.it
s\xFCdtirol.it
suedtirol.it
sv.it
ta.it
taranto.it
te.it
tempio-olbia.it
tempioolbia.it
teramo.it
terni.it
tn.it
to.it
torino.it
tp.it
tr.it
trani-andria-barletta.it
trani-barletta-andria.it
traniandriabarletta.it
tranibarlettaandria.it
trapani.it
trentino.it
trento.it
treviso.it
trieste.it
ts.it
turin.it
tv.it
ud.it
udine.it
urbino-pesaro.it
urbinopesaro.it
va.it
varese.it
vb.it
vc.it
ve.it
venezia.it
venice.it
verbania.it
verbano-cusio-ossola.it
vercelli.it
verona.it
vi.it
vibo-valentia.it
vibovalentia.it
vicenza.it
viterbo.it
vr.it
vs.it
vt.it
vv.it
je
co.je
net.je
org.je
*.jm
jo
agri.jo
ai.jo
com.jo
edu.jo
eng.jo
fm.jo
gov.jo
mil.jo
net.jo
org.jo
per.jo
phd.jo
sch.jo
tv.jo
jobs
jp
ac.jp
ad.jp
co.jp
ed.jp
go.jp
gr.jp
lg.jp
ne.jp
or.jp
aichi.jp
akita.jp
aomori.jp
chiba.jp
ehime.jp
fukui.jp
fukuoka.jp
fukushima.jp
gifu.jp
gunma.jp
hiroshima.jp
hokkaido.jp
hyogo.jp
ibaraki.jp
ishikawa.jp
iwate.jp
kagawa.jp
kagoshima.jp
kanagawa.jp
kochi.jp
kumamoto.jp
kyoto.jp
mie.jp
miyagi.jp
miyazaki.jp
nagano.jp
nagasaki.jp
nara.jp
niigata.jp
oita.jp
okayama.jp
okinawa.jp
osaka.jp
saga.jp
saitama.jp
shiga.jp
shimane.jp
shizuoka.jp
tochigi.jp
tokushima.jp
tokyo.jp
tottori.jp
toyama.jp
wakayama.jp
yamagata.jp
yamaguchi.jp
yamanashi.jp
\u4E09\u91CD.jp
\u4EAC\u90FD.jp
\u4F50\u8CC0.jp
\u5175\u5EAB.jp
\u5317\u6D77\u9053.jp
\u5343\u8449.jp
\u548C\u6B4C\u5C71.jp
\u57FC\u7389.jp
\u5927\u5206.jp
\u5927\u962A.jp
\u5948\u826F.jp
\u5BAE\u57CE.jp
\u5BAE\u5D0E.jp
\u5BCC\u5C71.jp
\u5C71\u53E3.jp
\u5C71\u5F62.jp
\u5C71\u68A8.jp
\u5C90\u961C.jp
\u5CA1\u5C71.jp
\u5CA9\u624B.jp
\u5CF6\u6839.jp
\u5E83\u5CF6.jp
\u5FB3\u5CF6.jp
\u611B\u5A9B.jp
\u611B\u77E5.jp
\u65B0\u6F5F.jp
\u6771\u4EAC.jp
\u6803\u6728.jp
\u6C96\u7E04.jp
\u6ECB\u8CC0.jp
\u718A\u672C.jp
\u77F3\u5DDD.jp
\u795E\u5948\u5DDD.jp
\u798F\u4E95.jp
\u798F\u5CA1.jp
\u798F\u5CF6.jp
\u79CB\u7530.jp
\u7FA4\u99AC.jp
\u8328\u57CE.jp
\u9577\u5D0E.jp
\u9577\u91CE.jp
\u9752\u68EE.jp
\u9759\u5CA1.jp
\u9999\u5DDD.jp
\u9AD8\u77E5.jp
\u9CE5\u53D6.jp
\u9E7F\u5150\u5CF6.jp
*.kawasaki.jp
!city.kawasaki.jp
*.kitakyushu.jp
!city.kitakyushu.jp
*.kobe.jp
!city.kobe.jp
*.nagoya.jp
!city.nagoya.jp
*.sapporo.jp
!city.sapporo.jp
*.sendai.jp
!city.sendai.jp
*.yokohama.jp
!city.yokohama.jp
aisai.aichi.jp
ama.aichi.jp
anjo.aichi.jp
asuke.aichi.jp
chiryu.aichi.jp
chita.aichi.jp
fuso.aichi.jp
gamagori.aichi.jp
handa.aichi.jp
hazu.aichi.jp
hekinan.aichi.jp
higashiura.aichi.jp
ichinomiya.aichi.jp
inazawa.aichi.jp
inuyama.aichi.jp
isshiki.aichi.jp
iwakura.aichi.jp
kanie.aichi.jp
kariya.aichi.jp
kasugai.aichi.jp
kira.aichi.jp
kiyosu.aichi.jp
komaki.aichi.jp
konan.aichi.jp
kota.aichi.jp
mihama.aichi.jp
miyoshi.aichi.jp
nishio.aichi.jp
nisshin.aichi.jp
obu.aichi.jp
oguchi.aichi.jp
oharu.aichi.jp
okazaki.aichi.jp
owariasahi.aichi.jp
seto.aichi.jp
shikatsu.aichi.jp
shinshiro.aichi.jp
shitara.aichi.jp
tahara.aichi.jp
takahama.aichi.jp
tobishima.aichi.jp
toei.aichi.jp
togo.aichi.jp
tokai.aichi.jp
tokoname.aichi.jp
toyoake.aichi.jp
toyohashi.aichi.jp
toyokawa.aichi.jp
toyone.aichi.jp
toyota.aichi.jp
tsushima.aichi.jp
yatomi.aichi.jp
akita.akita.jp
daisen.akita.jp
fujisato.akita.jp
gojome.akita.jp
hachirogata.akita.jp
happou.akita.jp
higashinaruse.akita.jp
honjo.akita.jp
honjyo.akita.jp
ikawa.akita.jp
kamikoani.akita.jp
kamioka.akita.jp
katagami.akita.jp
kazuno.akita.jp
kitaakita.akita.jp
kosaka.akita.jp
kyowa.akita.jp
misato.akita.jp
mitane.akita.jp
moriyoshi.akita.jp
nikaho.akita.jp
noshiro.akita.jp
odate.akita.jp
oga.akita.jp
ogata.akita.jp
semboku.akita.jp
yokote.akita.jp
yurihonjo.akita.jp
aomori.aomori.jp
gonohe.aomori.jp
hachinohe.aomori.jp
hashikami.aomori.jp
hiranai.aomori.jp
hirosaki.aomori.jp
itayanagi.aomori.jp
kuroishi.aomori.jp
misawa.aomori.jp
mutsu.aomori.jp
nakadomari.aomori.jp
noheji.aomori.jp
oirase.aomori.jp
owani.aomori.jp
rokunohe.aomori.jp
sannohe.aomori.jp
shichinohe.aomori.jp
shingo.aomori.jp
takko.aomori.jp
towada.aomori.jp
tsugaru.aomori.jp
tsuruta.aomori.jp
abiko.chiba.jp
asahi.chiba.jp
chonan.chiba.jp
chosei.chiba.jp
choshi.chiba.jp
chuo.chiba.jp
funabashi.chiba.jp
futtsu.chiba.jp
hanamigawa.chiba.jp
ichihara.chiba.jp
ichikawa.chiba.jp
ichinomiya.chiba.jp
inzai.chiba.jp
isumi.chiba.jp
kamagaya.chiba.jp
kamogawa.chiba.jp
kashiwa.chiba.jp
katori.chiba.jp
katsuura.chiba.jp
kimitsu.chiba.jp
kisarazu.chiba.jp
kozaki.chiba.jp
kujukuri.chiba.jp
kyonan.chiba.jp
matsudo.chiba.jp
midori.chiba.jp
mihama.chiba.jp
minamiboso.chiba.jp
mobara.chiba.jp
mutsuzawa.chiba.jp
nagara.chiba.jp
nagareyama.chiba.jp
narashino.chiba.jp
narita.chiba.jp
noda.chiba.jp
oamishirasato.chiba.jp
omigawa.chiba.jp
onjuku.chiba.jp
otaki.chiba.jp
sakae.chiba.jp
sakura.chiba.jp
shimofusa.chiba.jp
shirako.chiba.jp
shiroi.chiba.jp
shisui.chiba.jp
sodegaura.chiba.jp
sosa.chiba.jp
tako.chiba.jp
tateyama.chiba.jp
togane.chiba.jp
tohnosho.chiba.jp
tomisato.chiba.jp
urayasu.chiba.jp
yachimata.chiba.jp
yachiyo.chiba.jp
yokaichiba.chiba.jp
yokoshibahikari.chiba.jp
yotsukaido.chiba.jp
ainan.ehime.jp
honai.ehime.jp
ikata.ehime.jp
imabari.ehime.jp
iyo.ehime.jp
kamijima.ehime.jp
kihoku.ehime.jp
kumakogen.ehime.jp
masaki.ehime.jp
matsuno.ehime.jp
matsuyama.ehime.jp
namikata.ehime.jp
niihama.ehime.jp
ozu.ehime.jp
saijo.ehime.jp
seiyo.ehime.jp
shikokuchuo.ehime.jp
tobe.ehime.jp
toon.ehime.jp
uchiko.ehime.jp
uwajima.ehime.jp
yawatahama.ehime.jp
echizen.fukui.jp
eiheiji.fukui.jp
fukui.fukui.jp
ikeda.fukui.jp
katsuyama.fukui.jp
mihama.fukui.jp
minamiechizen.fukui.jp
obama.fukui.jp
ohi.fukui.jp
ono.fukui.jp
sabae.fukui.jp
sakai.fukui.jp
takahama.fukui.jp
tsuruga.fukui.jp
wakasa.fukui.jp
ashiya.fukuoka.jp
buzen.fukuoka.jp
chikugo.fukuoka.jp
chikuho.fukuoka.jp
chikujo.fukuoka.jp
chikushino.fukuoka.jp
chikuzen.fukuoka.jp
chuo.fukuoka.jp
dazaifu.fukuoka.jp
fukuchi.fukuoka.jp
hakata.fukuoka.jp
higashi.fukuoka.jp
hirokawa.fukuoka.jp
hisayama.fukuoka.jp
iizuka.fukuoka.jp
inatsuki.fukuoka.jp
kaho.fukuoka.jp
kasuga.fukuoka.jp
kasuya.fukuoka.jp
kawara.fukuoka.jp
keisen.fukuoka.jp
koga.fukuoka.jp
kurate.fukuoka.jp
kurogi.fukuoka.jp
kurume.fukuoka.jp
minami.fukuoka.jp
miyako.fukuoka.jp
miyama.fukuoka.jp
miyawaka.fukuoka.jp
mizumaki.fukuoka.jp
munakata.fukuoka.jp
nakagawa.fukuoka.jp
nakama.fukuoka.jp
nishi.fukuoka.jp
nogata.fukuoka.jp
ogori.fukuoka.jp
okagaki.fukuoka.jp
okawa.fukuoka.jp
oki.fukuoka.jp
omuta.fukuoka.jp
onga.fukuoka.jp
onojo.fukuoka.jp
oto.fukuoka.jp
saigawa.fukuoka.jp
sasaguri.fukuoka.jp
shingu.fukuoka.jp
shinyoshitomi.fukuoka.jp
shonai.fukuoka.jp
soeda.fukuoka.jp
sue.fukuoka.jp
tachiarai.fukuoka.jp
tagawa.fukuoka.jp
takata.fukuoka.jp
toho.fukuoka.jp
toyotsu.fukuoka.jp
tsuiki.fukuoka.jp
ukiha.fukuoka.jp
umi.fukuoka.jp
usui.fukuoka.jp
yamada.fukuoka.jp
yame.fukuoka.jp
yanagawa.fukuoka.jp
yukuhashi.fukuoka.jp
aizubange.fukushima.jp
aizumisato.fukushima.jp
aizuwakamatsu.fukushima.jp
asakawa.fukushima.jp
bandai.fukushima.jp
date.fukushima.jp
fukushima.fukushima.jp
furudono.fukushima.jp
futaba.fukushima.jp
hanawa.fukushima.jp
higashi.fukushima.jp
hirata.fukushima.jp
hirono.fukushima.jp
iitate.fukushima.jp
inawashiro.fukushima.jp
ishikawa.fukushima.jp
iwaki.fukushima.jp
izumizaki.fukushima.jp
kagamiishi.fukushima.jp
kaneyama.fukushima.jp
kawamata.fukushima.jp
kitakata.fukushima.jp
kitashiobara.fukushima.jp
koori.fukushima.jp
koriyama.fukushima.jp
kunimi.fukushima.jp
miharu.fukushima.jp
mishima.fukushima.jp
namie.fukushima.jp
nango.fukushima.jp
nishiaizu.fukushima.jp
nishigo.fukushima.jp
okuma.fukushima.jp
omotego.fukushima.jp
ono.fukushima.jp
otama.fukushima.jp
samegawa.fukushima.jp
shimogo.fukushima.jp
shirakawa.fukushima.jp
showa.fukushima.jp
soma.fukushima.jp
sukagawa.fukushima.jp
taishin.fukushima.jp
tamakawa.fukushima.jp
tanagura.fukushima.jp
tenei.fukushima.jp
yabuki.fukushima.jp
yamato.fukushima.jp
yamatsuri.fukushima.jp
yanaizu.fukushima.jp
yugawa.fukushima.jp
anpachi.gifu.jp
ena.gifu.jp
gifu.gifu.jp
ginan.gifu.jp
godo.gifu.jp
gujo.gifu.jp
hashima.gifu.jp
hichiso.gifu.jp
hida.gifu.jp
higashishirakawa.gifu.jp
ibigawa.gifu.jp
ikeda.gifu.jp
kakamigahara.gifu.jp
kani.gifu.jp
kasahara.gifu.jp
kasamatsu.gifu.jp
kawaue.gifu.jp
kitagata.gifu.jp
mino.gifu.jp
minokamo.gifu.jp
mitake.gifu.jp
mizunami.gifu.jp
motosu.gifu.jp
nakatsugawa.gifu.jp
ogaki.gifu.jp
sakahogi.gifu.jp
seki.gifu.jp
sekigahara.gifu.jp
shirakawa.gifu.jp
tajimi.gifu.jp
takayama.gifu.jp
tarui.gifu.jp
toki.gifu.jp
tomika.gifu.jp
wanouchi.gifu.jp
yamagata.gifu.jp
yaotsu.gifu.jp
yoro.gifu.jp
annaka.gunma.jp
chiyoda.gunma.jp
fujioka.gunma.jp
higashiagatsuma.gunma.jp
isesaki.gunma.jp
itakura.gunma.jp
kanna.gunma.jp
kanra.gunma.jp
katashina.gunma.jp
kawaba.gunma.jp
kiryu.gunma.jp
kusatsu.gunma.jp
maebashi.gunma.jp
meiwa.gunma.jp
midori.gunma.jp
minakami.gunma.jp
naganohara.gunma.jp
nakanojo.gunma.jp
nanmoku.gunma.jp
numata.gunma.jp
oizumi.gunma.jp
ora.gunma.jp
ota.gunma.jp
shibukawa.gunma.jp
shimonita.gunma.jp
shinto.gunma.jp
showa.gunma.jp
takasaki.gunma.jp
takayama.gunma.jp
tamamura.gunma.jp
tatebayashi.gunma.jp
tomioka.gunma.jp
tsukiyono.gunma.jp
tsumagoi.gunma.jp
ueno.gunma.jp
yoshioka.gunma.jp
asaminami.hiroshima.jp
daiwa.hiroshima.jp
etajima.hiroshima.jp
fuchu.hiroshima.jp
fukuyama.hiroshima.jp
hatsukaichi.hiroshima.jp
higashihiroshima.hiroshima.jp
hongo.hiroshima.jp
jinsekikogen.hiroshima.jp
kaita.hiroshima.jp
kui.hiroshima.jp
kumano.hiroshima.jp
kure.hiroshima.jp
mihara.hiroshima.jp
miyoshi.hiroshima.jp
naka.hiroshima.jp
onomichi.hiroshima.jp
osakikamijima.hiroshima.jp
otake.hiroshima.jp
saka.hiroshima.jp
sera.hiroshima.jp
seranishi.hiroshima.jp
shinichi.hiroshima.jp
shobara.hiroshima.jp
takehara.hiroshima.jp
abashiri.hokkaido.jp
abira.hokkaido.jp
aibetsu.hokkaido.jp
akabira.hokkaido.jp
akkeshi.hokkaido.jp
asahikawa.hokkaido.jp
ashibetsu.hokkaido.jp
ashoro.hokkaido.jp
assabu.hokkaido.jp
atsuma.hokkaido.jp
bibai.hokkaido.jp
biei.hokkaido.jp
bifuka.hokkaido.jp
bihoro.hokkaido.jp
biratori.hokkaido.jp
chippubetsu.hokkaido.jp
chitose.hokkaido.jp
date.hokkaido.jp
ebetsu.hokkaido.jp
embetsu.hokkaido.jp
eniwa.hokkaido.jp
erimo.hokkaido.jp
esan.hokkaido.jp
esashi.hokkaido.jp
fukagawa.hokkaido.jp
fukushima.hokkaido.jp
furano.hokkaido.jp
furubira.hokkaido.jp
haboro.hokkaido.jp
hakodate.hokkaido.jp
hamatonbetsu.hokkaido.jp
hidaka.hokkaido.jp
higashikagura.hokkaido.jp
higashikawa.hokkaido.jp
hiroo.hokkaido.jp
hokuryu.hokkaido.jp
hokuto.hokkaido.jp
honbetsu.hokkaido.jp
horokanai.hokkaido.jp
horonobe.hokkaido.jp
ikeda.hokkaido.jp
imakane.hokkaido.jp
ishikari.hokkaido.jp
iwamizawa.hokkaido.jp
iwanai.hokkaido.jp
kamifurano.hokkaido.jp
kamikawa.hokkaido.jp
kamishihoro.hokkaido.jp
kamisunagawa.hokkaido.jp
kamoenai.hokkaido.jp
kayabe.hokkaido.jp
kembuchi.hokkaido.jp
kikonai.hokkaido.jp
kimobetsu.hokkaido.jp
kitahiroshima.hokkaido.jp
kitami.hokkaido.jp
kiyosato.hokkaido.jp
koshimizu.hokkaido.jp
kunneppu.hokkaido.jp
kuriyama.hokkaido.jp
kuromatsunai.hokkaido.jp
kushiro.hokkaido.jp
kutchan.hokkaido.jp
kyowa.hokkaido.jp
mashike.hokkaido.jp
matsumae.hokkaido.jp
mikasa.hokkaido.jp
minamifurano.hokkaido.jp
mombetsu.hokkaido.jp
moseushi.hokkaido.jp
mukawa.hokkaido.jp
muroran.hokkaido.jp
naie.hokkaido.jp
nakagawa.hokkaido.jp
nakasatsunai.hokkaido.jp
nakatombetsu.hokkaido.jp
nanae.hokkaido.jp
nanporo.hokkaido.jp
nayoro.hokkaido.jp
nemuro.hokkaido.jp
niikappu.hokkaido.jp
niki.hokkaido.jp
nishiokoppe.hokkaido.jp
noboribetsu.hokkaido.jp
numata.hokkaido.jp
obihiro.hokkaido.jp
obira.hokkaido.jp
oketo.hokkaido.jp
okoppe.hokkaido.jp
otaru.hokkaido.jp
otobe.hokkaido.jp
otofuke.hokkaido.jp
otoineppu.hokkaido.jp
oumu.hokkaido.jp
ozora.hokkaido.jp
pippu.hokkaido.jp
rankoshi.hokkaido.jp
rebun.hokkaido.jp
rikubetsu.hokkaido.jp
rishiri.hokkaido.jp
rishirifuji.hokkaido.jp
saroma.hokkaido.jp
sarufutsu.hokkaido.jp
shakotan.hokkaido.jp
shari.hokkaido.jp
shibecha.hokkaido.jp
shibetsu.hokkaido.jp
shikabe.hokkaido.jp
shikaoi.hokkaido.jp
shimamaki.hokkaido.jp
shimizu.hokkaido.jp
shimokawa.hokkaido.jp
shinshinotsu.hokkaido.jp
shintoku.hokkaido.jp
shiranuka.hokkaido.jp
shiraoi.hokkaido.jp
shiriuchi.hokkaido.jp
sobetsu.hokkaido.jp
sunagawa.hokkaido.jp
taiki.hokkaido.jp
takasu.hokkaido.jp
takikawa.hokkaido.jp
takinoue.hokkaido.jp
teshikaga.hokkaido.jp
tobetsu.hokkaido.jp
tohma.hokkaido.jp
tomakomai.hokkaido.jp
tomari.hokkaido.jp
toya.hokkaido.jp
toyako.hokkaido.jp
toyotomi.hokkaido.jp
toyoura.hokkaido.jp
tsubetsu.hokkaido.jp
tsukigata.hokkaido.jp
urakawa.hokkaido.jp
urausu.hokkaido.jp
uryu.hokkaido.jp
utashinai.hokkaido.jp
wakkanai.hokkaido.jp
wassamu.hokkaido.jp
yakumo.hokkaido.jp
yoichi.hokkaido.jp
aioi.hyogo.jp
akashi.hyogo.jp
ako.hyogo.jp
amagasaki.hyogo.jp
aogaki.hyogo.jp
asago.hyogo.jp
ashiya.hyogo.jp
awaji.hyogo.jp
fukusaki.hyogo.jp
goshiki.hyogo.jp
harima.hyogo.jp
himeji.hyogo.jp
ichikawa.hyogo.jp
inagawa.hyogo.jp
itami.hyogo.jp
kakogawa.hyogo.jp
kamigori.hyogo.jp
kamikawa.hyogo.jp
kasai.hyogo.jp
kasuga.hyogo.jp
kawanishi.hyogo.jp
miki.hyogo.jp
minamiawaji.hyogo.jp
nishinomiya.hyogo.jp
nishiwaki.hyogo.jp
ono.hyogo.jp
sanda.hyogo.jp
sannan.hyogo.jp
sasayama.hyogo.jp
sayo.hyogo.jp
shingu.hyogo.jp
shinonsen.hyogo.jp
shiso.hyogo.jp
sumoto.hyogo.jp
taishi.hyogo.jp
taka.hyogo.jp
takarazuka.hyogo.jp
takasago.hyogo.jp
takino.hyogo.jp
tamba.hyogo.jp
tatsuno.hyogo.jp
toyooka.hyogo.jp
yabu.hyogo.jp
yashiro.hyogo.jp
yoka.hyogo.jp
yokawa.hyogo.jp
ami.ibaraki.jp
asahi.ibaraki.jp
bando.ibaraki.jp
chikusei.ibaraki.jp
daigo.ibaraki.jp
fujishiro.ibaraki.jp
hitachi.ibaraki.jp
hitachinaka.ibaraki.jp
hitachiomiya.ibaraki.jp
hitachiota.ibaraki.jp
ibaraki.ibaraki.jp
ina.ibaraki.jp
inashiki.ibaraki.jp
itako.ibaraki.jp
iwama.ibaraki.jp
joso.ibaraki.jp
kamisu.ibaraki.jp
kasama.ibaraki.jp
kashima.ibaraki.jp
kasumigaura.ibaraki.jp
koga.ibaraki.jp
miho.ibaraki.jp
mito.ibaraki.jp
moriya.ibaraki.jp
naka.ibaraki.jp
namegata.ibaraki.jp
oarai.ibaraki.jp
ogawa.ibaraki.jp
omitama.ibaraki.jp
ryugasaki.ibaraki.jp
sakai.ibaraki.jp
sakuragawa.ibaraki.jp
shimodate.ibaraki.jp
shimotsuma.ibaraki.jp
shirosato.ibaraki.jp
sowa.ibaraki.jp
suifu.ibaraki.jp
takahagi.ibaraki.jp
tamatsukuri.ibaraki.jp
tokai.ibaraki.jp
tomobe.ibaraki.jp
tone.ibaraki.jp
toride.ibaraki.jp
tsuchiura.ibaraki.jp
tsukuba.ibaraki.jp
uchihara.ibaraki.jp
ushiku.ibaraki.jp
yachiyo.ibaraki.jp
yamagata.ibaraki.jp
yawara.ibaraki.jp
yuki.ibaraki.jp
anamizu.ishikawa.jp
hakui.ishikawa.jp
hakusan.ishikawa.jp
kaga.ishikawa.jp
kahoku.ishikawa.jp
kanazawa.ishikawa.jp
kawakita.ishikawa.jp
komatsu.ishikawa.jp
nakanoto.ishikawa.jp
nanao.ishikawa.jp
nomi.ishikawa.jp
nonoichi.ishikawa.jp
noto.ishikawa.jp
shika.ishikawa.jp
suzu.ishikawa.jp
tsubata.ishikawa.jp
tsurugi.ishikawa.jp
uchinada.ishikawa.jp
wajima.ishikawa.jp
fudai.iwate.jp
fujisawa.iwate.jp
hanamaki.iwate.jp
hiraizumi.iwate.jp
hirono.iwate.jp
ichinohe.iwate.jp
ichinoseki.iwate.jp
iwaizumi.iwate.jp
iwate.iwate.jp
joboji.iwate.jp
kamaishi.iwate.jp
kanegasaki.iwate.jp
karumai.iwate.jp
kawai.iwate.jp
kitakami.iwate.jp
kuji.iwate.jp
kunohe.iwate.jp
kuzumaki.iwate.jp
miyako.iwate.jp
mizusawa.iwate.jp
morioka.iwate.jp
ninohe.iwate.jp
noda.iwate.jp
ofunato.iwate.jp
oshu.iwate.jp
otsuchi.iwate.jp
rikuzentakata.iwate.jp
shiwa.iwate.jp
shizukuishi.iwate.jp
sumita.iwate.jp
tanohata.iwate.jp
tono.iwate.jp
yahaba.iwate.jp
yamada.iwate.jp
ayagawa.kagawa.jp
higashikagawa.kagawa.jp
kanonji.kagawa.jp
kotohira.kagawa.jp
manno.kagawa.jp
marugame.kagawa.jp
mitoyo.kagawa.jp
naoshima.kagawa.jp
sanuki.kagawa.jp
tadotsu.kagawa.jp
takamatsu.kagawa.jp
tonosho.kagawa.jp
uchinomi.kagawa.jp
utazu.kagawa.jp
zentsuji.kagawa.jp
akune.kagoshima.jp
amami.kagoshima.jp
hioki.kagoshima.jp
isa.kagoshima.jp
isen.kagoshima.jp
izumi.kagoshima.jp
kagoshima.kagoshima.jp
kanoya.kagoshima.jp
kawanabe.kagoshima.jp
kinko.kagoshima.jp
kouyama.kagoshima.jp
makurazaki.kagoshima.jp
matsumoto.kagoshima.jp
minamitane.kagoshima.jp
nakatane.kagoshima.jp
nishinoomote.kagoshima.jp
satsumasendai.kagoshima.jp
soo.kagoshima.jp
tarumizu.kagoshima.jp
yusui.kagoshima.jp
aikawa.kanagawa.jp
atsugi.kanagawa.jp
ayase.kanagawa.jp
chigasaki.kanagawa.jp
ebina.kanagawa.jp
fujisawa.kanagawa.jp
hadano.kanagawa.jp
hakone.kanagawa.jp
hiratsuka.kanagawa.jp
isehara.kanagawa.jp
kaisei.kanagawa.jp
kamakura.kanagawa.jp
kiyokawa.kanagawa.jp
matsuda.kanagawa.jp
minamiashigara.kanagawa.jp
miura.kanagawa.jp
nakai.kanagawa.jp
ninomiya.kanagawa.jp
odawara.kanagawa.jp
oi.kanagawa.jp
oiso.kanagawa.jp
sagamihara.kanagawa.jp
samukawa.kanagawa.jp
tsukui.kanagawa.jp
yamakita.kanagawa.jp
yamato.kanagawa.jp
yokosuka.kanagawa.jp
yugawara.kanagawa.jp
zama.kanagawa.jp
zushi.kanagawa.jp
aki.kochi.jp
geisei.kochi.jp
hidaka.kochi.jp
higashitsuno.kochi.jp
ino.kochi.jp
kagami.kochi.jp
kami.kochi.jp
kitagawa.kochi.jp
kochi.kochi.jp
mihara.kochi.jp
motoyama.kochi.jp
muroto.kochi.jp
nahari.kochi.jp
nakamura.kochi.jp
nankoku.kochi.jp
nishitosa.kochi.jp
niyodogawa.kochi.jp
ochi.kochi.jp
okawa.kochi.jp
otoyo.kochi.jp
otsuki.kochi.jp
sakawa.kochi.jp
sukumo.kochi.jp
susaki.kochi.jp
tosa.kochi.jp
tosashimizu.kochi.jp
toyo.kochi.jp
tsuno.kochi.jp
umaji.kochi.jp
yasuda.kochi.jp
yusuhara.kochi.jp
amakusa.kumamoto.jp
arao.kumamoto.jp
aso.kumamoto.jp
choyo.kumamoto.jp
gyokuto.kumamoto.jp
kamiamakusa.kumamoto.jp
kikuchi.kumamoto.jp
kumamoto.kumamoto.jp
mashiki.kumamoto.jp
mifune.kumamoto.jp
minamata.kumamoto.jp
minamioguni.kumamoto.jp
nagasu.kumamoto.jp
nishihara.kumamoto.jp
oguni.kumamoto.jp
ozu.kumamoto.jp
sumoto.kumamoto.jp
takamori.kumamoto.jp
uki.kumamoto.jp
uto.kumamoto.jp
yamaga.kumamoto.jp
yamato.kumamoto.jp
yatsushiro.kumamoto.jp
ayabe.kyoto.jp
fukuchiyama.kyoto.jp
higashiyama.kyoto.jp
ide.kyoto.jp
ine.kyoto.jp
joyo.kyoto.jp
kameoka.kyoto.jp
kamo.kyoto.jp
kita.kyoto.jp
kizu.kyoto.jp
kumiyama.kyoto.jp
kyotamba.kyoto.jp
kyotanabe.kyoto.jp
kyotango.kyoto.jp
maizuru.kyoto.jp
minami.kyoto.jp
minamiyamashiro.kyoto.jp
miyazu.kyoto.jp
muko.kyoto.jp
nagaokakyo.kyoto.jp
nakagyo.kyoto.jp
nantan.kyoto.jp
oyamazaki.kyoto.jp
sakyo.kyoto.jp
seika.kyoto.jp
tanabe.kyoto.jp
uji.kyoto.jp
ujitawara.kyoto.jp
wazuka.kyoto.jp
yamashina.kyoto.jp
yawata.kyoto.jp
asahi.mie.jp
inabe.mie.jp
ise.mie.jp
kameyama.mie.jp
kawagoe.mie.jp
kiho.mie.jp
kisosaki.mie.jp
kiwa.mie.jp
komono.mie.jp
kumano.mie.jp
kuwana.mie.jp
matsusaka.mie.jp
meiwa.mie.jp
mihama.mie.jp
minamiise.mie.jp
misugi.mie.jp
miyama.mie.jp
nabari.mie.jp
shima.mie.jp
suzuka.mie.jp
tado.mie.jp
taiki.mie.jp
taki.mie.jp
tamaki.mie.jp
toba.mie.jp
tsu.mie.jp
udono.mie.jp
ureshino.mie.jp
watarai.mie.jp
yokkaichi.mie.jp
furukawa.miyagi.jp
higashimatsushima.miyagi.jp
ishinomaki.miyagi.jp
iwanuma.miyagi.jp
kakuda.miyagi.jp
kami.miyagi.jp
kawasaki.miyagi.jp
marumori.miyagi.jp
matsushima.miyagi.jp
minamisanriku.miyagi.jp
misato.miyagi.jp
murata.miyagi.jp
natori.miyagi.jp
ogawara.miyagi.jp
ohira.miyagi.jp
onagawa.miyagi.jp
osaki.miyagi.jp
rifu.miyagi.jp
semine.miyagi.jp
shibata.miyagi.jp
shichikashuku.miyagi.jp
shikama.miyagi.jp
shiogama.miyagi.jp
shiroishi.miyagi.jp
tagajo.miyagi.jp
taiwa.miyagi.jp
tome.miyagi.jp
tomiya.miyagi.jp
wakuya.miyagi.jp
watari.miyagi.jp
yamamoto.miyagi.jp
zao.miyagi.jp
aya.miyazaki.jp
ebino.miyazaki.jp
gokase.miyazaki.jp
hyuga.miyazaki.jp
kadogawa.miyazaki.jp
kawaminami.miyazaki.jp
kijo.miyazaki.jp
kitagawa.miyazaki.jp
kitakata.miyazaki.jp
kitaura.miyazaki.jp
kobayashi.miyazaki.jp
kunitomi.miyazaki.jp
kushima.miyazaki.jp
mimata.miyazaki.jp
miyakonojo.miyazaki.jp
miyazaki.miyazaki.jp
morotsuka.miyazaki.jp
nichinan.miyazaki.jp
nishimera.miyazaki.jp
nobeoka.miyazaki.jp
saito.miyazaki.jp
shiiba.miyazaki.jp
shintomi.miyazaki.jp
takaharu.miyazaki.jp
takanabe.miyazaki.jp
takazaki.miyazaki.jp
tsuno.miyazaki.jp
achi.nagano.jp
agematsu.nagano.jp
anan.nagano.jp
aoki.nagano.jp
asahi.nagano.jp
azumino.nagano.jp
chikuhoku.nagano.jp
chikuma.nagano.jp
chino.nagano.jp
fujimi.nagano.jp
hakuba.nagano.jp
hara.nagano.jp
hiraya.nagano.jp
iida.nagano.jp
iijima.nagano.jp
iiyama.nagano.jp
iizuna.nagano.jp
ikeda.nagano.jp
ikusaka.nagano.jp
ina.nagano.jp
karuizawa.nagano.jp
kawakami.nagano.jp
kiso.nagano.jp
kisofukushima.nagano.jp
kitaaiki.nagano.jp
komagane.nagano.jp
komoro.nagano.jp
matsukawa.nagano.jp
matsumoto.nagano.jp
miasa.nagano.jp
minamiaiki.nagano.jp
minamimaki.nagano.jp
minamiminowa.nagano.jp
minowa.nagano.jp
miyada.nagano.jp
miyota.nagano.jp
mochizuki.nagano.jp
nagano.nagano.jp
nagawa.nagano.jp
nagiso.nagano.jp
nakagawa.nagano.jp
nakano.nagano.jp
nozawaonsen.nagano.jp
obuse.nagano.jp
ogawa.nagano.jp
okaya.nagano.jp
omachi.nagano.jp
omi.nagano.jp
ookuwa.nagano.jp
ooshika.nagano.jp
otaki.nagano.jp
otari.nagano.jp
sakae.nagano.jp
sakaki.nagano.jp
saku.nagano.jp
sakuho.nagano.jp
shimosuwa.nagano.jp
shinanomachi.nagano.jp
shiojiri.nagano.jp
suwa.nagano.jp
suzaka.nagano.jp
takagi.nagano.jp
takamori.nagano.jp
takayama.nagano.jp
tateshina.nagano.jp
tatsuno.nagano.jp
togakushi.nagano.jp
togura.nagano.jp
tomi.nagano.jp
ueda.nagano.jp
wada.nagano.jp
yamagata.nagano.jp
yamanouchi.nagano.jp
yasaka.nagano.jp
yasuoka.nagano.jp
chijiwa.nagasaki.jp
futsu.nagasaki.jp
goto.nagasaki.jp
hasami.nagasaki.jp
hirado.nagasaki.jp
iki.nagasaki.jp
isahaya.nagasaki.jp
kawatana.nagasaki.jp
kuchinotsu.nagasaki.jp
matsuura.nagasaki.jp
nagasaki.nagasaki.jp
obama.nagasaki.jp
omura.nagasaki.jp
oseto.nagasaki.jp
saikai.nagasaki.jp
sasebo.nagasaki.jp
seihi.nagasaki.jp
shimabara.nagasaki.jp
shinkamigoto.nagasaki.jp
togitsu.nagasaki.jp
tsushima.nagasaki.jp
unzen.nagasaki.jp
ando.nara.jp
gose.nara.jp
heguri.nara.jp
higashiyoshino.nara.jp
ikaruga.nara.jp
ikoma.nara.jp
kamikitayama.nara.jp
kanmaki.nara.jp
kashiba.nara.jp
kashihara.nara.jp
katsuragi.nara.jp
kawai.nara.jp
kawakami.nara.jp
kawanishi.nara.jp
koryo.nara.jp
kurotaki.nara.jp
mitsue.nara.jp
miyake.nara.jp
nara.nara.jp
nosegawa.nara.jp
oji.nara.jp
ouda.nara.jp
oyodo.nara.jp
sakurai.nara.jp
sango.nara.jp
shimoichi.nara.jp
shimokitayama.nara.jp
shinjo.nara.jp
soni.nara.jp
takatori.nara.jp
tawaramoto.nara.jp
tenkawa.nara.jp
tenri.nara.jp
uda.nara.jp
yamatokoriyama.nara.jp
yamatotakada.nara.jp
yamazoe.nara.jp
yoshino.nara.jp
aga.niigata.jp
agano.niigata.jp
gosen.niigata.jp
itoigawa.niigata.jp
izumozaki.niigata.jp
joetsu.niigata.jp
kamo.niigata.jp
kariwa.niigata.jp
kashiwazaki.niigata.jp
minamiuonuma.niigata.jp
mitsuke.niigata.jp
muika.niigata.jp
murakami.niigata.jp
myoko.niigata.jp
nagaoka.niigata.jp
niigata.niigata.jp
ojiya.niigata.jp
omi.niigata.jp
sado.niigata.jp
sanjo.niigata.jp
seiro.niigata.jp
seirou.niigata.jp
sekikawa.niigata.jp
shibata.niigata.jp
tagami.niigata.jp
tainai.niigata.jp
tochio.niigata.jp
tokamachi.niigata.jp
tsubame.niigata.jp
tsunan.niigata.jp
uonuma.niigata.jp
yahiko.niigata.jp
yoita.niigata.jp
yuzawa.niigata.jp
beppu.oita.jp
bungoono.oita.jp
bungotakada.oita.jp
hasama.oita.jp
hiji.oita.jp
himeshima.oita.jp
hita.oita.jp
kamitsue.oita.jp
kokonoe.oita.jp
kuju.oita.jp
kunisaki.oita.jp
kusu.oita.jp
oita.oita.jp
saiki.oita.jp
taketa.oita.jp
tsukumi.oita.jp
usa.oita.jp
usuki.oita.jp
yufu.oita.jp
akaiwa.okayama.jp
asakuchi.okayama.jp
bizen.okayama.jp
hayashima.okayama.jp
ibara.okayama.jp
kagamino.okayama.jp
kasaoka.okayama.jp
kibichuo.okayama.jp
kumenan.okayama.jp
kurashiki.okayama.jp
maniwa.okayama.jp
misaki.okayama.jp
nagi.okayama.jp
niimi.okayama.jp
nishiawakura.okayama.jp
okayama.okayama.jp
satosho.okayama.jp
setouchi.okayama.jp
shinjo.okayama.jp
shoo.okayama.jp
soja.okayama.jp
takahashi.okayama.jp
tamano.okayama.jp
tsuyama.okayama.jp
wake.okayama.jp
yakage.okayama.jp
aguni.okinawa.jp
ginowan.okinawa.jp
ginoza.okinawa.jp
gushikami.okinawa.jp
haebaru.okinawa.jp
higashi.okinawa.jp
hirara.okinawa.jp
iheya.okinawa.jp
ishigaki.okinawa.jp
ishikawa.okinawa.jp
itoman.okinawa.jp
izena.okinawa.jp
kadena.okinawa.jp
kin.okinawa.jp
kitadaito.okinawa.jp
kitanakagusuku.okinawa.jp
kumejima.okinawa.jp
kunigami.okinawa.jp
minamidaito.okinawa.jp
motobu.okinawa.jp
nago.okinawa.jp
naha.okinawa.jp
nakagusuku.okinawa.jp
nakijin.okinawa.jp
nanjo.okinawa.jp
nishihara.okinawa.jp
ogimi.okinawa.jp
okinawa.okinawa.jp
onna.okinawa.jp
shimoji.okinawa.jp
taketomi.okinawa.jp
tarama.okinawa.jp
tokashiki.okinawa.jp
tomigusuku.okinawa.jp
tonaki.okinawa.jp
urasoe.okinawa.jp
uruma.okinawa.jp
yaese.okinawa.jp
yomitan.okinawa.jp
yonabaru.okinawa.jp
yonaguni.okinawa.jp
zamami.okinawa.jp
abeno.osaka.jp
chihayaakasaka.osaka.jp
chuo.osaka.jp
daito.osaka.jp
fujiidera.osaka.jp
habikino.osaka.jp
hannan.osaka.jp
higashiosaka.osaka.jp
higashisumiyoshi.osaka.jp
higashiyodogawa.osaka.jp
hirakata.osaka.jp
ibaraki.osaka.jp
ikeda.osaka.jp
izumi.osaka.jp
izumiotsu.osaka.jp
izumisano.osaka.jp
kadoma.osaka.jp
kaizuka.osaka.jp
kanan.osaka.jp
kashiwara.osaka.jp
katano.osaka.jp
kawachinagano.osaka.jp
kishiwada.osaka.jp
kita.osaka.jp
kumatori.osaka.jp
matsubara.osaka.jp
minato.osaka.jp
minoh.osaka.jp
misaki.osaka.jp
moriguchi.osaka.jp
neyagawa.osaka.jp
nishi.osaka.jp
nose.osaka.jp
osakasayama.osaka.jp
sakai.osaka.jp
sayama.osaka.jp
sennan.osaka.jp
settsu.osaka.jp
shijonawate.osaka.jp
shimamoto.osaka.jp
suita.osaka.jp
tadaoka.osaka.jp
taishi.osaka.jp
tajiri.osaka.jp
takaishi.osaka.jp
takatsuki.osaka.jp
tondabayashi.osaka.jp
toyonaka.osaka.jp
toyono.osaka.jp
yao.osaka.jp
ariake.saga.jp
arita.saga.jp
fukudomi.saga.jp
genkai.saga.jp
hamatama.saga.jp
hizen.saga.jp
imari.saga.jp
kamimine.saga.jp
kanzaki.saga.jp
karatsu.saga.jp
kashima.saga.jp
kitagata.saga.jp
kitahata.saga.jp
kiyama.saga.jp
kouhoku.saga.jp
kyuragi.saga.jp
nishiarita.saga.jp
ogi.saga.jp
omachi.saga.jp
ouchi.saga.jp
saga.saga.jp
shiroishi.saga.jp
taku.saga.jp
tara.saga.jp
tosu.saga.jp
yoshinogari.saga.jp
arakawa.saitama.jp
asaka.saitama.jp
chichibu.saitama.jp
fujimi.saitama.jp
fujimino.saitama.jp
fukaya.saitama.jp
hanno.saitama.jp
hanyu.saitama.jp
hasuda.saitama.jp
hatogaya.saitama.jp
hatoyama.saitama.jp
hidaka.saitama.jp
higashichichibu.saitama.jp
higashimatsuyama.saitama.jp
honjo.saitama.jp
ina.saitama.jp
iruma.saitama.jp
iwatsuki.saitama.jp
kamiizumi.saitama.jp
kamikawa.saitama.jp
kamisato.saitama.jp
kasukabe.saitama.jp
kawagoe.saitama.jp
kawaguchi.saitama.jp
kawajima.saitama.jp
kazo.saitama.jp
kitamoto.saitama.jp
koshigaya.saitama.jp
kounosu.saitama.jp
kuki.saitama.jp
kumagaya.saitama.jp
matsubushi.saitama.jp
minano.saitama.jp
misato.saitama.jp
miyashiro.saitama.jp
miyoshi.saitama.jp
moroyama.saitama.jp
nagatoro.saitama.jp
namegawa.saitama.jp
niiza.saitama.jp
ogano.saitama.jp
ogawa.saitama.jp
ogose.saitama.jp
okegawa.saitama.jp
omiya.saitama.jp
otaki.saitama.jp
ranzan.saitama.jp
ryokami.saitama.jp
saitama.saitama.jp
sakado.saitama.jp
satte.saitama.jp
sayama.saitama.jp
shiki.saitama.jp
shiraoka.saitama.jp
soka.saitama.jp
sugito.saitama.jp
toda.saitama.jp
tokigawa.saitama.jp
tokorozawa.saitama.jp
tsurugashima.saitama.jp
urawa.saitama.jp
warabi.saitama.jp
yashio.saitama.jp
yokoze.saitama.jp
yono.saitama.jp
yorii.saitama.jp
yoshida.saitama.jp
yoshikawa.saitama.jp
yoshimi.saitama.jp
aisho.shiga.jp
gamo.shiga.jp
higashiomi.shiga.jp
hikone.shiga.jp
koka.shiga.jp
konan.shiga.jp
kosei.shiga.jp
koto.shiga.jp
kusatsu.shiga.jp
maibara.shiga.jp
moriyama.shiga.jp
nagahama.shiga.jp
nishiazai.shiga.jp
notogawa.shiga.jp
omihachiman.shiga.jp
otsu.shiga.jp
ritto.shiga.jp
ryuoh.shiga.jp
takashima.shiga.jp
takatsuki.shiga.jp
torahime.shiga.jp
toyosato.shiga.jp
yasu.shiga.jp
akagi.shimane.jp
ama.shimane.jp
gotsu.shimane.jp
hamada.shimane.jp
higashiizumo.shimane.jp
hikawa.shimane.jp
hikimi.shimane.jp
izumo.shimane.jp
kakinoki.shimane.jp
masuda.shimane.jp
matsue.shimane.jp
misato.shimane.jp
nishinoshima.shimane.jp
ohda.shimane.jp
okinoshima.shimane.jp
okuizumo.shimane.jp
shimane.shimane.jp
tamayu.shimane.jp
tsuwano.shimane.jp
unnan.shimane.jp
yakumo.shimane.jp
yasugi.shimane.jp
yatsuka.shimane.jp
arai.shizuoka.jp
atami.shizuoka.jp
fuji.shizuoka.jp
fujieda.shizuoka.jp
fujikawa.shizuoka.jp
fujinomiya.shizuoka.jp
fukuroi.shizuoka.jp
gotemba.shizuoka.jp
haibara.shizuoka.jp
hamamatsu.shizuoka.jp
higashiizu.shizuoka.jp
ito.shizuoka.jp
iwata.shizuoka.jp
izu.shizuoka.jp
izunokuni.shizuoka.jp
kakegawa.shizuoka.jp
kannami.shizuoka.jp
kawanehon.shizuoka.jp
kawazu.shizuoka.jp
kikugawa.shizuoka.jp
kosai.shizuoka.jp
makinohara.shizuoka.jp
matsuzaki.shizuoka.jp
minamiizu.shizuoka.jp
mishima.shizuoka.jp
morimachi.shizuoka.jp
nishiizu.shizuoka.jp
numazu.shizuoka.jp
omaezaki.shizuoka.jp
shimada.shizuoka.jp
shimizu.shizuoka.jp
shimoda.shizuoka.jp
shizuoka.shizuoka.jp
susono.shizuoka.jp
yaizu.shizuoka.jp
yoshida.shizuoka.jp
ashikaga.tochigi.jp
bato.tochigi.jp
haga.tochigi.jp
ichikai.tochigi.jp
iwafune.tochigi.jp
kaminokawa.tochigi.jp
kanuma.tochigi.jp
karasuyama.tochigi.jp
kuroiso.tochigi.jp
mashiko.tochigi.jp
mibu.tochigi.jp
moka.tochigi.jp
motegi.tochigi.jp
nasu.tochigi.jp
nasushiobara.tochigi.jp
nikko.tochigi.jp
nishikata.tochigi.jp
nogi.tochigi.jp
ohira.tochigi.jp
ohtawara.tochigi.jp
oyama.tochigi.jp
sakura.tochigi.jp
sano.tochigi.jp
shimotsuke.tochigi.jp
shioya.tochigi.jp
takanezawa.tochigi.jp
tochigi.tochigi.jp
tsuga.tochigi.jp
ujiie.tochigi.jp
utsunomiya.tochigi.jp
yaita.tochigi.jp
aizumi.tokushima.jp
anan.tokushima.jp
ichiba.tokushima.jp
itano.tokushima.jp
kainan.tokushima.jp
komatsushima.tokushima.jp
matsushige.tokushima.jp
mima.tokushima.jp
minami.tokushima.jp
miyoshi.tokushima.jp
mugi.tokushima.jp
nakagawa.tokushima.jp
naruto.tokushima.jp
sanagochi.tokushima.jp
shishikui.tokushima.jp
tokushima.tokushima.jp
wajiki.tokushima.jp
adachi.tokyo.jp
akiruno.tokyo.jp
akishima.tokyo.jp
aogashima.tokyo.jp
arakawa.tokyo.jp
bunkyo.tokyo.jp
chiyoda.tokyo.jp
chofu.tokyo.jp
chuo.tokyo.jp
edogawa.tokyo.jp
fuchu.tokyo.jp
fussa.tokyo.jp
hachijo.tokyo.jp
hachioji.tokyo.jp
hamura.tokyo.jp
higashikurume.tokyo.jp
higashimurayama.tokyo.jp
higashiyamato.tokyo.jp
hino.tokyo.jp
hinode.tokyo.jp
hinohara.tokyo.jp
inagi.tokyo.jp
itabashi.tokyo.jp
katsushika.tokyo.jp
kita.tokyo.jp
kiyose.tokyo.jp
kodaira.tokyo.jp
koganei.tokyo.jp
kokubunji.tokyo.jp
komae.tokyo.jp
koto.tokyo.jp
kouzushima.tokyo.jp
kunitachi.tokyo.jp
machida.tokyo.jp
meguro.tokyo.jp
minato.tokyo.jp
mitaka.tokyo.jp
mizuho.tokyo.jp
musashimurayama.tokyo.jp
musashino.tokyo.jp
nakano.tokyo.jp
nerima.tokyo.jp
ogasawara.tokyo.jp
okutama.tokyo.jp
ome.tokyo.jp
oshima.tokyo.jp
ota.tokyo.jp
setagaya.tokyo.jp
shibuya.tokyo.jp
shinagawa.tokyo.jp
shinjuku.tokyo.jp
suginami.tokyo.jp
sumida.tokyo.jp
tachikawa.tokyo.jp
taito.tokyo.jp
tama.tokyo.jp
toshima.tokyo.jp
chizu.tottori.jp
hino.tottori.jp
kawahara.tottori.jp
koge.tottori.jp
kotoura.tottori.jp
misasa.tottori.jp
nanbu.tottori.jp
nichinan.tottori.jp
sakaiminato.tottori.jp
tottori.tottori.jp
wakasa.tottori.jp
yazu.tottori.jp
yonago.tottori.jp
asahi.toyama.jp
fuchu.toyama.jp
fukumitsu.toyama.jp
funahashi.toyama.jp
himi.toyama.jp
imizu.toyama.jp
inami.toyama.jp
johana.toyama.jp
kamiichi.toyama.jp
kurobe.toyama.jp
nakaniikawa.toyama.jp
namerikawa.toyama.jp
nanto.toyama.jp
nyuzen.toyama.jp
oyabe.toyama.jp
taira.toyama.jp
takaoka.toyama.jp
tateyama.toyama.jp
toga.toyama.jp
tonami.toyama.jp
toyama.toyama.jp
unazuki.toyama.jp
uozu.toyama.jp
yamada.toyama.jp
arida.wakayama.jp
aridagawa.wakayama.jp
gobo.wakayama.jp
hashimoto.wakayama.jp
hidaka.wakayama.jp
hirogawa.wakayama.jp
inami.wakayama.jp
iwade.wakayama.jp
kainan.wakayama.jp
kamitonda.wakayama.jp
katsuragi.wakayama.jp
kimino.wakayama.jp
kinokawa.wakayama.jp
kitayama.wakayama.jp
koya.wakayama.jp
koza.wakayama.jp
kozagawa.wakayama.jp
kudoyama.wakayama.jp
kushimoto.wakayama.jp
mihama.wakayama.jp
misato.wakayama.jp
nachikatsuura.wakayama.jp
shingu.wakayama.jp
shirahama.wakayama.jp
taiji.wakayama.jp
tanabe.wakayama.jp
wakayama.wakayama.jp
yuasa.wakayama.jp
yura.wakayama.jp
asahi.yamagata.jp
funagata.yamagata.jp
higashine.yamagata.jp
iide.yamagata.jp
kahoku.yamagata.jp
kaminoyama.yamagata.jp
kaneyama.yamagata.jp
kawanishi.yamagata.jp
mamurogawa.yamagata.jp
mikawa.yamagata.jp
murayama.yamagata.jp
nagai.yamagata.jp
nakayama.yamagata.jp
nanyo.yamagata.jp
nishikawa.yamagata.jp
obanazawa.yamagata.jp
oe.yamagata.jp
oguni.yamagata.jp
ohkura.yamagata.jp
oishida.yamagata.jp
sagae.yamagata.jp
sakata.yamagata.jp
sakegawa.yamagata.jp
shinjo.yamagata.jp
shirataka.yamagata.jp
shonai.yamagata.jp
takahata.yamagata.jp
tendo.yamagata.jp
tozawa.yamagata.jp
tsuruoka.yamagata.jp
yamagata.yamagata.jp
yamanobe.yamagata.jp
yonezawa.yamagata.jp
yuza.yamagata.jp
abu.yamaguchi.jp
hagi.yamaguchi.jp
hikari.yamaguchi.jp
hofu.yamaguchi.jp
iwakuni.yamaguchi.jp
kudamatsu.yamaguchi.jp
mitou.yamaguchi.jp
nagato.yamaguchi.jp
oshima.yamaguchi.jp
shimonoseki.yamaguchi.jp
shunan.yamaguchi.jp
tabuse.yamaguchi.jp
tokuyama.yamaguchi.jp
toyota.yamaguchi.jp
ube.yamaguchi.jp
yuu.yamaguchi.jp
chuo.yamanashi.jp
doshi.yamanashi.jp
fuefuki.yamanashi.jp
fujikawa.yamanashi.jp
fujikawaguchiko.yamanashi.jp
fujiyoshida.yamanashi.jp
hayakawa.yamanashi.jp
hokuto.yamanashi.jp
ichikawamisato.yamanashi.jp
kai.yamanashi.jp
kofu.yamanashi.jp
koshu.yamanashi.jp
kosuge.yamanashi.jp
minami-alps.yamanashi.jp
minobu.yamanashi.jp
nakamichi.yamanashi.jp
nanbu.yamanashi.jp
narusawa.yamanashi.jp
nirasaki.yamanashi.jp
nishikatsura.yamanashi.jp
oshino.yamanashi.jp
otsuki.yamanashi.jp
showa.yamanashi.jp
tabayama.yamanashi.jp
tsuru.yamanashi.jp
uenohara.yamanashi.jp
yamanakako.yamanashi.jp
yamanashi.yamanashi.jp
ke
ac.ke
co.ke
go.ke
info.ke
me.ke
mobi.ke
ne.ke
or.ke
sc.ke
kg
com.kg
edu.kg
gov.kg
mil.kg
net.kg
org.kg
kh
com.kh
edu.kh
gov.kh
net.kh
org.kh
ki
biz.ki
com.ki
edu.ki
gov.ki
info.ki
net.ki
org.ki
km
ass.km
com.km
edu.km
gov.km
mil.km
nom.km
org.km
prd.km
tm.km
asso.km
coop.km
gouv.km
medecin.km
notaires.km
pharmaciens.km
presse.km
veterinaire.km
kn
edu.kn
gov.kn
net.kn
org.kn
kp
com.kp
edu.kp
gov.kp
org.kp
rep.kp
tra.kp
kr
ac.kr
ai.kr
co.kr
es.kr
go.kr
hs.kr
io.kr
it.kr
kg.kr
me.kr
mil.kr
ms.kr
ne.kr
or.kr
pe.kr
re.kr
sc.kr
busan.kr
chungbuk.kr
chungnam.kr
daegu.kr
daejeon.kr
gangwon.kr
gwangju.kr
gyeongbuk.kr
gyeonggi.kr
gyeongnam.kr
incheon.kr
jeju.kr
jeonbuk.kr
jeonnam.kr
seoul.kr
ulsan.kr
kw
com.kw
edu.kw
emb.kw
gov.kw
ind.kw
net.kw
org.kw
ky
com.ky
edu.ky
net.ky
org.ky
kz
com.kz
edu.kz
gov.kz
mil.kz
net.kz
org.kz
la
com.la
edu.la
gov.la
info.la
int.la
net.la
org.la
per.la
lb
com.lb
edu.lb
gov.lb
net.lb
org.lb
lc
co.lc
com.lc
edu.lc
gov.lc
net.lc
org.lc
li
lk
ac.lk
assn.lk
com.lk
edu.lk
gov.lk
grp.lk
hotel.lk
int.lk
ltd.lk
net.lk
ngo.lk
org.lk
sch.lk
soc.lk
web.lk
lr
com.lr
edu.lr
gov.lr
net.lr
org.lr
ls
ac.ls
biz.ls
co.ls
edu.ls
gov.ls
info.ls
net.ls
org.ls
sc.ls
lt
gov.lt
lu
lv
asn.lv
com.lv
conf.lv
edu.lv
gov.lv
id.lv
mil.lv
net.lv
org.lv
ly
com.ly
edu.ly
gov.ly
id.ly
med.ly
net.ly
org.ly
plc.ly
sch.ly
ma
ac.ma
co.ma
gov.ma
net.ma
org.ma
press.ma
mc
asso.mc
tm.mc
md
me
ac.me
co.me
edu.me
gov.me
its.me
net.me
org.me
priv.me
mg
co.mg
com.mg
edu.mg
gov.mg
mil.mg
nom.mg
org.mg
prd.mg
mh
mil
mk
com.mk
edu.mk
gov.mk
inf.mk
name.mk
net.mk
org.mk
ml
ac.ml
art.ml
asso.ml
com.ml
edu.ml
gouv.ml
gov.ml
info.ml
inst.ml
net.ml
org.ml
pr.ml
presse.ml
*.mm
mn
edu.mn
gov.mn
org.mn
mo
com.mo
edu.mo
gov.mo
net.mo
org.mo
mobi
mp
mq
mr
gov.mr
ms
com.ms
edu.ms
gov.ms
net.ms
org.ms
mt
com.mt
edu.mt
net.mt
org.mt
mu
ac.mu
co.mu
com.mu
gov.mu
net.mu
or.mu
org.mu
museum
mv
aero.mv
biz.mv
com.mv
coop.mv
edu.mv
gov.mv
info.mv
int.mv
mil.mv
museum.mv
name.mv
net.mv
org.mv
pro.mv
mw
ac.mw
biz.mw
co.mw
com.mw
coop.mw
edu.mw
gov.mw
int.mw
net.mw
org.mw
mx
com.mx
edu.mx
gob.mx
net.mx
org.mx
my
biz.my
com.my
edu.my
gov.my
mil.my
name.my
net.my
org.my
mz
ac.mz
adv.mz
co.mz
edu.mz
gov.mz
mil.mz
net.mz
org.mz
na
alt.na
co.na
com.na
gov.na
net.na
org.na
name
nc
asso.nc
nom.nc
ne
net
nf
arts.nf
com.nf
firm.nf
info.nf
net.nf
other.nf
per.nf
rec.nf
store.nf
web.nf
ng
com.ng
edu.ng
gov.ng
i.ng
mil.ng
mobi.ng
name.ng
net.ng
org.ng
sch.ng
ni
ac.ni
biz.ni
co.ni
com.ni
edu.ni
gob.ni
in.ni
info.ni
int.ni
mil.ni
net.ni
nom.ni
org.ni
web.ni
nl
no
fhs.no
folkebibl.no
fylkesbibl.no
gielda.no
herad.no
idrett.no
kommune.no
museum.no
priv.no
suohkan.no
tjielte.no
uenorge.no
vgs.no
dep.no
mil.no
stat.no
aa.no
ah.no
bu.no
fm.no
hl.no
hm.no
jan-mayen.no
mr.no
nl.no
nt.no
of.no
ol.no
oslo.no
rl.no
sf.no
st.no
svalbard.no
tm.no
tr.no
va.no
vf.no
gs.aa.no
gs.ah.no
gs.bu.no
gs.fm.no
gs.hl.no
gs.hm.no
gs.jan-mayen.no
gs.mr.no
gs.nl.no
gs.nt.no
gs.of.no
gs.ol.no
gs.oslo.no
gs.rl.no
gs.sf.no
gs.st.no
gs.svalbard.no
gs.tm.no
gs.tr.no
gs.va.no
gs.vf.no
akrehamn.no
\xE5krehamn.no
algard.no
\xE5lg\xE5rd.no
arna.no
bronnoysund.no
br\xF8nn\xF8ysund.no
brumunddal.no
bryne.no
drobak.no
dr\xF8bak.no
egersund.no
fetsund.no
floro.no
flor\xF8.no
fredrikstad.no
hokksund.no
honefoss.no
h\xF8nefoss.no
jessheim.no
jorpeland.no
j\xF8rpeland.no
kirkenes.no
kopervik.no
krokstadelva.no
langevag.no
langev\xE5g.no
leirvik.no
mjondalen.no
mj\xF8ndalen.no
mo-i-rana.no
mosjoen.no
mosj\xF8en.no
nesoddtangen.no
orkanger.no
osoyro.no
os\xF8yro.no
raholt.no
r\xE5holt.no
sandnessjoen.no
sandnessj\xF8en.no
skedsmokorset.no
slattum.no
spjelkavik.no
stathelle.no
stavern.no
stjordalshalsen.no
stj\xF8rdalshalsen.no
tananger.no
tranby.no
vossevangen.no
aarborte.no
aejrie.no
afjord.no
\xE5fjord.no
agdenes.no
nes.akershus.no
aknoluokta.no
\xE1k\u014Boluokta.no
al.no
\xE5l.no
alaheadju.no
\xE1laheadju.no
alesund.no
\xE5lesund.no
alstahaug.no
alta.no
\xE1lt\xE1.no
alvdal.no
amli.no
\xE5mli.no
amot.no
\xE5mot.no
andasuolo.no
andebu.no
andoy.no
and\xF8y.no
ardal.no
\xE5rdal.no
aremark.no
arendal.no
\xE5s.no
aseral.no
\xE5seral.no
asker.no
askim.no
askoy.no
ask\xF8y.no
askvoll.no
asnes.no
\xE5snes.no
audnedal.no
aukra.no
aure.no
aurland.no
aurskog-holand.no
aurskog-h\xF8land.no
austevoll.no
austrheim.no
averoy.no
aver\xF8y.no
badaddja.no
b\xE5d\xE5ddj\xE5.no
b\xE6rum.no
bahcavuotna.no
b\xE1hcavuotna.no
bahccavuotna.no
b\xE1hccavuotna.no
baidar.no
b\xE1id\xE1r.no
bajddar.no
b\xE1jddar.no
balat.no
b\xE1l\xE1t.no
balestrand.no
ballangen.no
balsfjord.no
bamble.no
bardu.no
barum.no
batsfjord.no
b\xE5tsfjord.no
bearalvahki.no
bearalv\xE1hki.no
beardu.no
beiarn.no
berg.no
bergen.no
berlevag.no
berlev\xE5g.no
bievat.no
biev\xE1t.no
bindal.no
birkenes.no
bjerkreim.no
bjugn.no
bodo.no
bod\xF8.no
bokn.no
bomlo.no
b\xF8mlo.no
bremanger.no
bronnoy.no
br\xF8nn\xF8y.no
budejju.no
nes.buskerud.no
bygland.no
bykle.no
cahcesuolo.no
\u010D\xE1hcesuolo.no
davvenjarga.no
davvenj\xE1rga.no
davvesiida.no
deatnu.no
dielddanuorri.no
divtasvuodna.no
divttasvuotna.no
donna.no
d\xF8nna.no
dovre.no
drammen.no
drangedal.no
dyroy.no
dyr\xF8y.no
eid.no
eidfjord.no
eidsberg.no
eidskog.no
eidsvoll.no
eigersund.no
elverum.no
enebakk.no
engerdal.no
etne.no
etnedal.no
evenassi.no
even\xE1\u0161\u0161i.no
evenes.no
evje-og-hornnes.no
farsund.no
fauske.no
fedje.no
fet.no
finnoy.no
finn\xF8y.no
fitjar.no
fjaler.no
fjell.no
fla.no
fl\xE5.no
flakstad.no
flatanger.no
flekkefjord.no
flesberg.no
flora.no
folldal.no
forde.no
f\xF8rde.no
forsand.no
fosnes.no
fr\xE6na.no
frana.no
frogn.no
froland.no
frosta.no
froya.no
fr\xF8ya.no
fuoisku.no
fuossko.no
fusa.no
fyresdal.no
gaivuotna.no
g\xE1ivuotna.no
galsa.no
g\xE1ls\xE1.no
gamvik.no
gangaviika.no
g\xE1\u014Bgaviika.no
gaular.no
gausdal.no
giehtavuoatna.no
gildeskal.no
gildesk\xE5l.no
giske.no
gjemnes.no
gjerdrum.no
gjerstad.no
gjesdal.no
gjovik.no
gj\xF8vik.no
gloppen.no
gol.no
gran.no
grane.no
granvin.no
gratangen.no
grimstad.no
grong.no
grue.no
gulen.no
guovdageaidnu.no
ha.no
h\xE5.no
habmer.no
h\xE1bmer.no
hadsel.no
h\xE6gebostad.no
hagebostad.no
halden.no
halsa.no
hamar.no
hamaroy.no
hamar\xF8y.no
hammarfeasta.no
h\xE1mm\xE1rfeasta.no
hammerfest.no
hapmir.no
h\xE1pmir.no
haram.no
hareid.no
harstad.no
hasvik.no
hattfjelldal.no
haugesund.no
os.hedmark.no
valer.hedmark.no
v\xE5ler.hedmark.no
hemne.no
hemnes.no
hemsedal.no
hitra.no
hjartdal.no
hjelmeland.no
hobol.no
hob\xF8l.no
hof.no
hol.no
hole.no
holmestrand.no
holtalen.no
holt\xE5len.no
os.hordaland.no
hornindal.no
horten.no
hoyanger.no
h\xF8yanger.no
hoylandet.no
h\xF8ylandet.no
hurdal.no
hurum.no
hvaler.no
hyllestad.no
ibestad.no
inderoy.no
inder\xF8y.no
iveland.no
ivgu.no
jevnaker.no
jolster.no
j\xF8lster.no
jondal.no
kafjord.no
k\xE5fjord.no
karasjohka.no
k\xE1r\xE1\u0161johka.no
karasjok.no
karlsoy.no
karls\xF8y.no
karmoy.no
karm\xF8y.no
kautokeino.no
klabu.no
kl\xE6bu.no
klepp.no
kongsberg.no
kongsvinger.no
kraanghke.no
kr\xE5anghke.no
kragero.no
krager\xF8.no
kristiansand.no
kristiansund.no
krodsherad.no
kr\xF8dsherad.no
kv\xE6fjord.no
kv\xE6nangen.no
kvafjord.no
kvalsund.no
kvam.no
kvanangen.no
kvinesdal.no
kvinnherad.no
kviteseid.no
kvitsoy.no
kvits\xF8y.no
laakesvuemie.no
l\xE6rdal.no
lahppi.no
l\xE1hppi.no
lardal.no
larvik.no
lavagis.no
lavangen.no
leangaviika.no
lea\u014Bgaviika.no
lebesby.no
leikanger.no
leirfjord.no
leka.no
leksvik.no
lenvik.no
lerdal.no
lesja.no
levanger.no
lier.no
lierne.no
lillehammer.no
lillesand.no
lindas.no
lind\xE5s.no
lindesnes.no
loabat.no
loab\xE1t.no
lodingen.no
l\xF8dingen.no
lom.no
loppa.no
lorenskog.no
l\xF8renskog.no
loten.no
l\xF8ten.no
lund.no
lunner.no
luroy.no
lur\xF8y.no
luster.no
lyngdal.no
lyngen.no
malatvuopmi.no
m\xE1latvuopmi.no
malselv.no
m\xE5lselv.no
malvik.no
mandal.no
marker.no
marnardal.no
masfjorden.no
masoy.no
m\xE5s\xF8y.no
matta-varjjat.no
m\xE1tta-v\xE1rjjat.no
meland.no
meldal.no
melhus.no
meloy.no
mel\xF8y.no
meraker.no
mer\xE5ker.no
midsund.no
midtre-gauldal.no
moareke.no
mo\xE5reke.no
modalen.no
modum.no
molde.no
heroy.more-og-romsdal.no
sande.more-og-romsdal.no
her\xF8y.m\xF8re-og-romsdal.no
sande.m\xF8re-og-romsdal.no
moskenes.no
moss.no
muosat.no
muos\xE1t.no
naamesjevuemie.no
n\xE5\xE5mesjevuemie.no
n\xE6r\xF8y.no
namdalseid.no
namsos.no
namsskogan.no
nannestad.no
naroy.no
narviika.no
narvik.no
naustdal.no
navuotna.no
n\xE1vuotna.no
nedre-eiker.no
nesna.no
nesodden.no
nesseby.no
nesset.no
nissedal.no
nittedal.no
nord-aurdal.no
nord-fron.no
nord-odal.no
norddal.no
nordkapp.no
bo.nordland.no
b\xF8.nordland.no
heroy.nordland.no
her\xF8y.nordland.no
nordre-land.no
nordreisa.no
nore-og-uvdal.no
notodden.no
notteroy.no
n\xF8tter\xF8y.no
odda.no
oksnes.no
\xF8ksnes.no
omasvuotna.no
oppdal.no
oppegard.no
oppeg\xE5rd.no
orkdal.no
orland.no
\xF8rland.no
orskog.no
\xF8rskog.no
orsta.no
\xF8rsta.no
osen.no
osteroy.no
oster\xF8y.no
valer.ostfold.no
v\xE5ler.\xF8stfold.no
ostre-toten.no
\xF8stre-toten.no
overhalla.no
ovre-eiker.no
\xF8vre-eiker.no
oyer.no
\xF8yer.no
oygarden.no
\xF8ygarden.no
oystre-slidre.no
\xF8ystre-slidre.no
porsanger.no
porsangu.no
pors\xE1\u014Bgu.no
porsgrunn.no
rade.no
r\xE5de.no
radoy.no
rad\xF8y.no
r\xE6lingen.no
rahkkeravju.no
r\xE1hkker\xE1vju.no
raisa.no
r\xE1isa.no
rakkestad.no
ralingen.no
rana.no
randaberg.no
rauma.no
re.no
rendalen.no
rennebu.no
rennesoy.no
rennes\xF8y.no
rindal.no
ringebu.no
ringerike.no
ringsaker.no
risor.no
ris\xF8r.no
rissa.no
roan.no
rodoy.no
r\xF8d\xF8y.no
rollag.no
romsa.no
romskog.no
r\xF8mskog.no
roros.no
r\xF8ros.no
rost.no
r\xF8st.no
royken.no
r\xF8yken.no
royrvik.no
r\xF8yrvik.no
ruovat.no
rygge.no
salangen.no
salat.no
s\xE1lat.no
s\xE1l\xE1t.no
saltdal.no
samnanger.no
sandefjord.no
sandnes.no
sandoy.no
sand\xF8y.no
sarpsborg.no
sauda.no
sauherad.no
sel.no
selbu.no
selje.no
seljord.no
siellak.no
sigdal.no
siljan.no
sirdal.no
skanit.no
sk\xE1nit.no
skanland.no
sk\xE5nland.no
skaun.no
skedsmo.no
ski.no
skien.no
skierva.no
skierv\xE1.no
skiptvet.no
skjak.no
skj\xE5k.no
skjervoy.no
skjerv\xF8y.no
skodje.no
smola.no
sm\xF8la.no
snaase.no
sn\xE5ase.no
snasa.no
sn\xE5sa.no
snillfjord.no
snoasa.no
sogndal.no
sogne.no
s\xF8gne.no
sokndal.no
sola.no
solund.no
somna.no
s\xF8mna.no
sondre-land.no
s\xF8ndre-land.no
songdalen.no
sor-aurdal.no
s\xF8r-aurdal.no
sor-fron.no
s\xF8r-fron.no
sor-odal.no
s\xF8r-odal.no
sor-varanger.no
s\xF8r-varanger.no
sorfold.no
s\xF8rfold.no
sorreisa.no
s\xF8rreisa.no
sortland.no
sorum.no
s\xF8rum.no
spydeberg.no
stange.no
stavanger.no
steigen.no
steinkjer.no
stjordal.no
stj\xF8rdal.no
stokke.no
stor-elvdal.no
stord.no
stordal.no
storfjord.no
strand.no
stranda.no
stryn.no
sula.no
suldal.no
sund.no
sunndal.no
surnadal.no
sveio.no
svelvik.no
sykkylven.no
tana.no
bo.telemark.no
b\xF8.telemark.no
time.no
tingvoll.no
tinn.no
tjeldsund.no
tjome.no
tj\xF8me.no
tokke.no
tolga.no
tonsberg.no
t\xF8nsberg.no
torsken.no
tr\xE6na.no
trana.no
tranoy.no
tran\xF8y.no
troandin.no
trogstad.no
tr\xF8gstad.no
tromsa.no
tromso.no
troms\xF8.no
trondheim.no
trysil.no
tvedestrand.no
tydal.no
tynset.no
tysfjord.no
tysnes.no
tysv\xE6r.no
tysvar.no
ullensaker.no
ullensvang.no
ulstein.no
ulvik.no
unjarga.no
unj\xE1rga.no
utsira.no
vaapste.no
vadso.no
vads\xF8.no
v\xE6r\xF8y.no
vaga.no
v\xE5g\xE5.no
vagan.no
v\xE5gan.no
vagsoy.no
v\xE5gs\xF8y.no
vaksdal.no
valle.no
vang.no
vanylven.no
vardo.no
vard\xF8.no
varggat.no
v\xE1rgg\xE1t.no
varoy.no
vefsn.no
vega.no
vegarshei.no
veg\xE5rshei.no
vennesla.no
verdal.no
verran.no
vestby.no
sande.vestfold.no
vestnes.no
vestre-slidre.no
vestre-toten.no
vestvagoy.no
vestv\xE5g\xF8y.no
vevelstad.no
vik.no
vikna.no
vindafjord.no
voagat.no
volda.no
voss.no
*.np
nr
biz.nr
com.nr
edu.nr
gov.nr
info.nr
net.nr
org.nr
nu
nz
ac.nz
co.nz
cri.nz
geek.nz
gen.nz
govt.nz
health.nz
iwi.nz
kiwi.nz
maori.nz
m\u0101ori.nz
mil.nz
net.nz
org.nz
parliament.nz
school.nz
om
co.om
com.om
edu.om
gov.om
med.om
museum.om
net.om
org.om
pro.om
onion
org
pa
abo.pa
ac.pa
com.pa
edu.pa
gob.pa
ing.pa
med.pa
net.pa
nom.pa
org.pa
sld.pa
pe
com.pe
edu.pe
gob.pe
mil.pe
net.pe
nom.pe
org.pe
pf
com.pf
edu.pf
org.pf
*.pg
ph
com.ph
edu.ph
gov.ph
i.ph
mil.ph
net.ph
ngo.ph
org.ph
pk
ac.pk
biz.pk
com.pk
edu.pk
fam.pk
gkp.pk
gob.pk
gog.pk
gok.pk
gop.pk
gos.pk
gov.pk
net.pk
org.pk
web.pk
pl
com.pl
net.pl
org.pl
agro.pl
aid.pl
atm.pl
auto.pl
biz.pl
edu.pl
gmina.pl
gsm.pl
info.pl
mail.pl
media.pl
miasta.pl
mil.pl
nieruchomosci.pl
nom.pl
pc.pl
powiat.pl
priv.pl
realestate.pl
rel.pl
sex.pl
shop.pl
sklep.pl
sos.pl
szkola.pl
targi.pl
tm.pl
tourism.pl
travel.pl
turystyka.pl
gov.pl
ap.gov.pl
griw.gov.pl
ic.gov.pl
is.gov.pl
kmpsp.gov.pl
konsulat.gov.pl
kppsp.gov.pl
kwp.gov.pl
kwpsp.gov.pl
mup.gov.pl
mw.gov.pl
oia.gov.pl
oirm.gov.pl
oke.gov.pl
oow.gov.pl
oschr.gov.pl
oum.gov.pl
pa.gov.pl
pinb.gov.pl
piw.gov.pl
po.gov.pl
pr.gov.pl
psp.gov.pl
psse.gov.pl
pup.gov.pl
rzgw.gov.pl
sa.gov.pl
sdn.gov.pl
sko.gov.pl
so.gov.pl
sr.gov.pl
starostwo.gov.pl
ug.gov.pl
ugim.gov.pl
um.gov.pl
umig.gov.pl
upow.gov.pl
uppo.gov.pl
us.gov.pl
uw.gov.pl
uzs.gov.pl
wif.gov.pl
wiih.gov.pl
winb.gov.pl
wios.gov.pl
witd.gov.pl
wiw.gov.pl
wkz.gov.pl
wsa.gov.pl
wskr.gov.pl
wsse.gov.pl
wuoz.gov.pl
wzmiuw.gov.pl
zp.gov.pl
zpisdn.gov.pl
augustow.pl
babia-gora.pl
bedzin.pl
beskidy.pl
bialowieza.pl
bialystok.pl
bielawa.pl
bieszczady.pl
boleslawiec.pl
bydgoszcz.pl
bytom.pl
cieszyn.pl
czeladz.pl
czest.pl
dlugoleka.pl
elblag.pl
elk.pl
glogow.pl
gniezno.pl
gorlice.pl
grajewo.pl
ilawa.pl
jaworzno.pl
jelenia-gora.pl
jgora.pl
kalisz.pl
karpacz.pl
kartuzy.pl
kaszuby.pl
katowice.pl
kazimierz-dolny.pl
kepno.pl
ketrzyn.pl
klodzko.pl
kobierzyce.pl
kolobrzeg.pl
konin.pl
konskowola.pl
kutno.pl
lapy.pl
lebork.pl
legnica.pl
lezajsk.pl
limanowa.pl
lomza.pl
lowicz.pl
lubin.pl
lukow.pl
malbork.pl
malopolska.pl
mazowsze.pl
mazury.pl
mielec.pl
mielno.pl
mragowo.pl
naklo.pl
nowaruda.pl
nysa.pl
olawa.pl
olecko.pl
olkusz.pl
olsztyn.pl
opoczno.pl
opole.pl
ostroda.pl
ostroleka.pl
ostrowiec.pl
ostrowwlkp.pl
pila.pl
pisz.pl
podhale.pl
podlasie.pl
polkowice.pl
pomorskie.pl
pomorze.pl
prochowice.pl
pruszkow.pl
przeworsk.pl
pulawy.pl
radom.pl
rawa-maz.pl
rybnik.pl
rzeszow.pl
sanok.pl
sejny.pl
skoczow.pl
slask.pl
slupsk.pl
sosnowiec.pl
stalowa-wola.pl
starachowice.pl
stargard.pl
suwalki.pl
swidnica.pl
swiebodzin.pl
swinoujscie.pl
szczecin.pl
szczytno.pl
tarnobrzeg.pl
tgory.pl
turek.pl
tychy.pl
ustka.pl
walbrzych.pl
warmia.pl
warszawa.pl
waw.pl
wegrow.pl
wielun.pl
wlocl.pl
wloclawek.pl
wodzislaw.pl
wolomin.pl
wroclaw.pl
zachpomor.pl
zagan.pl
zarow.pl
zgora.pl
zgorzelec.pl
pm
pn
co.pn
edu.pn
gov.pn
net.pn
org.pn
post
pr
ac.pr
biz.pr
com.pr
edu.pr
est.pr
gov.pr
info.pr
isla.pr
name.pr
net.pr
org.pr
pro.pr
prof.pr
pro
aaa.pro
aca.pro
acct.pro
avocat.pro
bar.pro
cpa.pro
eng.pro
jur.pro
law.pro
med.pro
recht.pro
ps
com.ps
edu.ps
gov.ps
net.ps
org.ps
plo.ps
sec.ps
pt
com.pt
edu.pt
gov.pt
int.pt
net.pt
nome.pt
org.pt
publ.pt
pw
gov.pw
py
com.py
coop.py
edu.py
gov.py
mil.py
net.py
org.py
qa
com.qa
edu.qa
gov.qa
mil.qa
name.qa
net.qa
org.qa
sch.qa
re
asso.re
com.re
ro
arts.ro
com.ro
firm.ro
info.ro
nom.ro
nt.ro
org.ro
rec.ro
store.ro
tm.ro
www.ro
rs
ac.rs
co.rs
edu.rs
gov.rs
in.rs
org.rs
ru
rw
ac.rw
co.rw
coop.rw
gov.rw
mil.rw
net.rw
org.rw
sa
com.sa
edu.sa
gov.sa
med.sa
net.sa
org.sa
pub.sa
sch.sa
sb
com.sb
edu.sb
gov.sb
net.sb
org.sb
sc
com.sc
edu.sc
gov.sc
net.sc
org.sc
sd
com.sd
edu.sd
gov.sd
info.sd
med.sd
net.sd
org.sd
tv.sd
se
a.se
ac.se
b.se
bd.se
brand.se
c.se
d.se
e.se
f.se
fh.se
fhsk.se
fhv.se
g.se
h.se
i.se
k.se
komforb.se
kommunalforbund.se
komvux.se
l.se
lanbib.se
m.se
n.se
naturbruksgymn.se
o.se
org.se
p.se
parti.se
pp.se
press.se
r.se
s.se
t.se
tm.se
u.se
w.se
x.se
y.se
z.se
sg
com.sg
edu.sg
gov.sg
net.sg
org.sg
sh
com.sh
gov.sh
mil.sh
net.sh
org.sh
si
sj
sk
org.sk
sl
com.sl
edu.sl
gov.sl
net.sl
org.sl
sm
sn
art.sn
com.sn
edu.sn
gouv.sn
org.sn
univ.sn
so
com.so
edu.so
gov.so
me.so
net.so
org.so
sr
ss
biz.ss
co.ss
com.ss
edu.ss
gov.ss
me.ss
net.ss
org.ss
sch.ss
st
co.st
com.st
consulado.st
edu.st
embaixada.st
mil.st
net.st
org.st
principe.st
saotome.st
store.st
su
sv
com.sv
edu.sv
gob.sv
org.sv
red.sv
sx
gov.sx
sy
com.sy
edu.sy
gov.sy
mil.sy
net.sy
org.sy
sz
ac.sz
co.sz
org.sz
tc
td
tel
tf
tg
th
ac.th
co.th
go.th
in.th
mi.th
net.th
or.th
tj
biz.tj
co.tj
com.tj
edu.tj
go.tj
gov.tj
int.tj
mil.tj
name.tj
net.tj
nic.tj
org.tj
test.tj
web.tj
tk
tl
gov.tl
tm
co.tm
com.tm
edu.tm
gov.tm
mil.tm
net.tm
nom.tm
org.tm
tn
com.tn
ens.tn
fin.tn
gov.tn
ind.tn
info.tn
intl.tn
mincom.tn
nat.tn
net.tn
org.tn
perso.tn
tourism.tn
to
com.to
edu.to
gov.to
mil.to
net.to
org.to
tr
av.tr
bbs.tr
bel.tr
biz.tr
com.tr
dr.tr
edu.tr
gen.tr
gov.tr
info.tr
k12.tr
kep.tr
mil.tr
name.tr
net.tr
org.tr
pol.tr
tel.tr
tsk.tr
tv.tr
web.tr
nc.tr
gov.nc.tr
tt
biz.tt
co.tt
com.tt
edu.tt
gov.tt
info.tt
mil.tt
name.tt
net.tt
org.tt
pro.tt
tv
tw
club.tw
com.tw
ebiz.tw
edu.tw
game.tw
gov.tw
idv.tw
mil.tw
net.tw
org.tw
tz
ac.tz
co.tz
go.tz
hotel.tz
info.tz
me.tz
mil.tz
mobi.tz
ne.tz
or.tz
sc.tz
tv.tz
ua
com.ua
edu.ua
gov.ua
in.ua
net.ua
org.ua
cherkassy.ua
cherkasy.ua
chernigov.ua
chernihiv.ua
chernivtsi.ua
chernovtsy.ua
ck.ua
cn.ua
cr.ua
crimea.ua
cv.ua
dn.ua
dnepropetrovsk.ua
dnipropetrovsk.ua
donetsk.ua
dp.ua
if.ua
ivano-frankivsk.ua
kh.ua
kharkiv.ua
kharkov.ua
kherson.ua
khmelnitskiy.ua
khmelnytskyi.ua
kiev.ua
kirovograd.ua
km.ua
kr.ua
kropyvnytskyi.ua
krym.ua
ks.ua
kv.ua
kyiv.ua
lg.ua
lt.ua
lugansk.ua
luhansk.ua
lutsk.ua
lv.ua
lviv.ua
mk.ua
mykolaiv.ua
nikolaev.ua
od.ua
odesa.ua
odessa.ua
pl.ua
poltava.ua
rivne.ua
rovno.ua
rv.ua
sb.ua
sebastopol.ua
sevastopol.ua
sm.ua
sumy.ua
te.ua
ternopil.ua
uz.ua
uzhgorod.ua
uzhhorod.ua
vinnica.ua
vinnytsia.ua
vn.ua
volyn.ua
yalta.ua
zakarpattia.ua
zaporizhzhe.ua
zaporizhzhia.ua
zhitomir.ua
zhytomyr.ua
zp.ua
zt.ua
ug
ac.ug
co.ug
com.ug
edu.ug
go.ug
gov.ug
mil.ug
ne.ug
or.ug
org.ug
sc.ug
us.ug
uk
ac.uk
co.uk
gov.uk
ltd.uk
me.uk
net.uk
nhs.uk
org.uk
plc.uk
police.uk
*.sch.uk
us
dni.us
isa.us
nsn.us
ak.us
al.us
ar.us
as.us
az.us
ca.us
co.us
ct.us
dc.us
de.us
fl.us
ga.us
gu.us
hi.us
ia.us
id.us
il.us
in.us
ks.us
ky.us
la.us
ma.us
md.us
me.us
mi.us
mn.us
mo.us
ms.us
mt.us
nc.us
nd.us
ne.us
nh.us
nj.us
nm.us
nv.us
ny.us
oh.us
ok.us
or.us
pa.us
pr.us
ri.us
sc.us
sd.us
tn.us
tx.us
ut.us
va.us
vi.us
vt.us
wa.us
wi.us
wv.us
wy.us
k12.ak.us
k12.al.us
k12.ar.us
k12.as.us
k12.az.us
k12.ca.us
k12.co.us
k12.ct.us
k12.dc.us
k12.fl.us
k12.ga.us
k12.gu.us
k12.ia.us
k12.id.us
k12.il.us
k12.in.us
k12.ks.us
k12.ky.us
k12.la.us
k12.ma.us
k12.md.us
k12.me.us
k12.mi.us
k12.mn.us
k12.mo.us
k12.ms.us
k12.mt.us
k12.nc.us
k12.ne.us
k12.nh.us
k12.nj.us
k12.nm.us
k12.nv.us
k12.ny.us
k12.oh.us
k12.ok.us
k12.or.us
k12.pa.us
k12.pr.us
k12.sc.us
k12.tn.us
k12.tx.us
k12.ut.us
k12.va.us
k12.vi.us
k12.vt.us
k12.wa.us
k12.wi.us
cc.ak.us
lib.ak.us
cc.al.us
lib.al.us
cc.ar.us
lib.ar.us
cc.as.us
lib.as.us
cc.az.us
lib.az.us
cc.ca.us
lib.ca.us
cc.co.us
lib.co.us
cc.ct.us
lib.ct.us
cc.dc.us
lib.dc.us
cc.de.us
cc.fl.us
lib.fl.us
cc.ga.us
lib.ga.us
cc.gu.us
lib.gu.us
cc.hi.us
lib.hi.us
cc.ia.us
lib.ia.us
cc.id.us
lib.id.us
cc.il.us
lib.il.us
cc.in.us
lib.in.us
cc.ks.us
lib.ks.us
cc.ky.us
lib.ky.us
cc.la.us
lib.la.us
cc.ma.us
lib.ma.us
cc.md.us
lib.md.us
cc.me.us
lib.me.us
cc.mi.us
lib.mi.us
cc.mn.us
lib.mn.us
cc.mo.us
lib.mo.us
cc.ms.us
cc.mt.us
lib.mt.us
cc.nc.us
lib.nc.us
cc.ne.us
lib.ne.us
cc.nh.us
lib.nh.us
cc.nj.us
lib.nj.us
cc.nm.us
lib.nm.us
cc.nv.us
lib.nv.us
cc.ny.us
lib.ny.us
cc.oh.us
lib.oh.us
cc.ok.us
lib.ok.us
cc.or.us
lib.or.us
cc.pa.us
lib.pa.us
cc.pr.us
lib.pr.us
cc.ri.us
lib.ri.us
cc.sc.us
lib.sc.us
cc.sd.us
lib.sd.us
cc.tn.us
lib.tn.us
cc.tx.us
lib.tx.us
cc.ut.us
lib.ut.us
cc.va.us
lib.va.us
cc.vi.us
lib.vi.us
cc.vt.us
lib.vt.us
cc.wa.us
lib.wa.us
cc.wi.us
lib.wi.us
cc.wv.us
cc.wy.us
k12.wy.us
lib.wy.us
chtr.k12.ma.us
paroch.k12.ma.us
pvt.k12.ma.us
ann-arbor.mi.us
cog.mi.us
dst.mi.us
eaton.mi.us
gen.mi.us
mus.mi.us
tec.mi.us
washtenaw.mi.us
uy
com.uy
edu.uy
gub.uy
mil.uy
net.uy
org.uy
uz
co.uz
com.uz
net.uz
org.uz
va
vc
com.vc
edu.vc
gov.vc
mil.vc
net.vc
org.vc
ve
arts.ve
bib.ve
co.ve
com.ve
e12.ve
edu.ve
emprende.ve
firm.ve
gob.ve
gov.ve
ia.ve
info.ve
int.ve
mil.ve
net.ve
nom.ve
org.ve
rar.ve
rec.ve
store.ve
tec.ve
web.ve
vg
edu.vg
vi
co.vi
com.vi
k12.vi
net.vi
org.vi
vn
ac.vn
ad.vn
ai.vn
ap.vn
biz.vn
com.vn
edu.vn
gov.vn
health.vn
id.vn
info.vn
int.vn
io.vn
name.vn
net.vn
on.vn
org.vn
pro.vn
angiang.vn
bacgiang.vn
backan.vn
baclieu.vn
bacninh.vn
baria-vungtau.vn
bentre.vn
binhdinh.vn
binhduong.vn
binhphuoc.vn
binhthuan.vn
camau.vn
cantho.vn
caobang.vn
daklak.vn
daknong.vn
danang.vn
dienbien.vn
dongnai.vn
dongthap.vn
gialai.vn
hagiang.vn
haiduong.vn
haiphong.vn
hanam.vn
hanoi.vn
hatinh.vn
haugiang.vn
hoabinh.vn
hue.vn
hungyen.vn
khanhhoa.vn
kiengiang.vn
kontum.vn
laichau.vn
lamdong.vn
langson.vn
laocai.vn
longan.vn
namdinh.vn
nghean.vn
ninhbinh.vn
ninhthuan.vn
phutho.vn
phuyen.vn
quangbinh.vn
quangnam.vn
quangngai.vn
quangninh.vn
quangtri.vn
soctrang.vn
sonla.vn
tayninh.vn
thaibinh.vn
thainguyen.vn
thanhhoa.vn
thanhphohochiminh.vn
thuathienhue.vn
tiengiang.vn
travinh.vn
tuyenquang.vn
vinhlong.vn
vinhphuc.vn
yenbai.vn
vu
com.vu
edu.vu
net.vu
org.vu
wf
ws
com.ws
edu.ws
gov.ws
net.ws
org.ws
yt
\u0627\u0645\u0627\u0631\u0627\u062A
\u0570\u0561\u0575
\u09AC\u09BE\u0982\u09B2\u09BE
\u0431\u0433
\u0627\u0644\u0628\u062D\u0631\u064A\u0646
\u0431\u0435\u043B
\u4E2D\u56FD
\u4E2D\u570B
\u0627\u0644\u062C\u0632\u0627\u0626\u0631
\u0645\u0635\u0631
\u0435\u044E
\u03B5\u03C5
\u0645\u0648\u0631\u064A\u062A\u0627\u0646\u064A\u0627
\u10D2\u10D4
\u03B5\u03BB
\u9999\u6E2F
\u500B\u4EBA.\u9999\u6E2F
\u516C\u53F8.\u9999\u6E2F
\u653F\u5E9C.\u9999\u6E2F
\u6559\u80B2.\u9999\u6E2F
\u7D44\u7E54.\u9999\u6E2F
\u7DB2\u7D61.\u9999\u6E2F
\u0CAD\u0CBE\u0CB0\u0CA4
\u0B2D\u0B3E\u0B30\u0B24
\u09AD\u09BE\u09F0\u09A4
\u092D\u093E\u0930\u0924\u092E\u094D
\u092D\u093E\u0930\u094B\u0924
\u0680\u0627\u0631\u062A
\u0D2D\u0D3E\u0D30\u0D24\u0D02
\u092D\u093E\u0930\u0924
\u0628\u0627\u0631\u062A
\u0628\u06BE\u0627\u0631\u062A
\u0C2D\u0C3E\u0C30\u0C24\u0C4D
\u0AAD\u0ABE\u0AB0\u0AA4
\u0A2D\u0A3E\u0A30\u0A24
\u09AD\u09BE\u09B0\u09A4
\u0B87\u0BA8\u0BCD\u0BA4\u0BBF\u0BAF\u0BBE
\u0627\u06CC\u0631\u0627\u0646
\u0627\u064A\u0631\u0627\u0646
\u0639\u0631\u0627\u0642
\u0627\u0644\u0627\u0631\u062F\u0646
\uD55C\uAD6D
\u049B\u0430\u0437
\u0EA5\u0EB2\u0EA7
\u0DBD\u0D82\u0D9A\u0DCF
\u0B87\u0BB2\u0B99\u0BCD\u0B95\u0BC8
\u0627\u0644\u0645\u063A\u0631\u0628
\u043C\u043A\u0434
\u043C\u043E\u043D
\u6FB3\u9580
\u6FB3\u95E8
\u0645\u0644\u064A\u0633\u064A\u0627
\u0639\u0645\u0627\u0646
\u067E\u0627\u06A9\u0633\u062A\u0627\u0646
\u067E\u0627\u0643\u0633\u062A\u0627\u0646
\u0641\u0644\u0633\u0637\u064A\u0646
\u0441\u0440\u0431
\u0430\u043A.\u0441\u0440\u0431
\u043E\u0431\u0440.\u0441\u0440\u0431
\u043E\u0434.\u0441\u0440\u0431
\u043E\u0440\u0433.\u0441\u0440\u0431
\u043F\u0440.\u0441\u0440\u0431
\u0443\u043F\u0440.\u0441\u0440\u0431
\u0440\u0444
\u0642\u0637\u0631
\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629
\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u0629
\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u06C3
\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0647
\u0633\u0648\u062F\u0627\u0646
\u65B0\u52A0\u5761
\u0B9A\u0BBF\u0B99\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0BC2\u0BB0\u0BCD
\u0633\u0648\u0631\u064A\u0629
\u0633\u0648\u0631\u064A\u0627
\u0E44\u0E17\u0E22
\u0E17\u0E2B\u0E32\u0E23.\u0E44\u0E17\u0E22
\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08.\u0E44\u0E17\u0E22
\u0E40\u0E19\u0E47\u0E15.\u0E44\u0E17\u0E22
\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25.\u0E44\u0E17\u0E22
\u0E28\u0E36\u0E01\u0E29\u0E32.\u0E44\u0E17\u0E22
\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23.\u0E44\u0E17\u0E22
\u062A\u0648\u0646\u0633
\u53F0\u7063
\u53F0\u6E7E
\u81FA\u7063
\u0443\u043A\u0440
\u0627\u0644\u064A\u0645\u0646
xxx
ye
com.ye
edu.ye
gov.ye
mil.ye
net.ye
org.ye
ac.za
agric.za
alt.za
co.za
edu.za
gov.za
grondar.za
law.za
mil.za
net.za
ngo.za
nic.za
nis.za
nom.za
org.za
school.za
tm.za
web.za
zm
ac.zm
biz.zm
co.zm
com.zm
edu.zm
gov.zm
info.zm
mil.zm
net.zm
org.zm
sch.zm
zw
ac.zw
co.zw
gov.zw
mil.zw
org.zw
aaa
aarp
abb
abbott
abbvie
abc
able
abogado
abudhabi
academy
accenture
accountant
accountants
aco
actor
ads
adult
aeg
aetna
afl
africa
agakhan
agency
aig
airbus
airforce
airtel
akdn
alibaba
alipay
allfinanz
allstate
ally
alsace
alstom
amazon
americanexpress
americanfamily
amex
amfam
amica
amsterdam
analytics
android
anquan
anz
aol
apartments
app
apple
aquarelle
arab
aramco
archi
army
art
arte
asda
associates
athleta
attorney
auction
audi
audible
audio
auspost
author
auto
autos
aws
axa
azure
baby
baidu
banamex
band
bank
bar
barcelona
barclaycard
barclays
barefoot
bargains
baseball
basketball
bauhaus
bayern
bbc
bbt
bbva
bcg
bcn
beats
beauty
beer
berlin
best
bestbuy
bet
bharti
bible
bid
bike
bing
bingo
bio
black
blackfriday
blockbuster
blog
bloomberg
blue
bms
bmw
bnpparibas
boats
boehringer
bofa
bom
bond
boo
book
booking
bosch
bostik
boston
bot
boutique
box
bradesco
bridgestone
broadway
broker
brother
brussels
build
builders
business
buy
buzz
bzh
cab
cafe
cal
call
calvinklein
cam
camera
camp
canon
capetown
capital
capitalone
car
caravan
cards
care
career
careers
cars
casa
case
cash
casino
catering
catholic
cba
cbn
cbre
center
ceo
cern
cfa
cfd
chanel
channel
charity
chase
chat
cheap
chintai
christmas
chrome
church
cipriani
circle
cisco
citadel
citi
citic
city
claims
cleaning
click
clinic
clinique
clothing
cloud
club
clubmed
coach
codes
coffee
college
cologne
commbank
community
company
compare
computer
comsec
condos
construction
consulting
contact
contractors
cooking
cool
corsica
country
coupon
coupons
courses
cpa
credit
creditcard
creditunion
cricket
crown
crs
cruise
cruises
cuisinella
cymru
cyou
dad
dance
data
date
dating
datsun
day
dclk
dds
deal
dealer
deals
degree
delivery
dell
deloitte
delta
democrat
dental
dentist
desi
design
dev
dhl
diamonds
diet
digital
direct
directory
discount
discover
dish
diy
dnp
docs
doctor
dog
domains
dot
download
drive
dtv
dubai
dupont
durban
dvag
dvr
earth
eat
eco
edeka
education
email
emerck
energy
engineer
engineering
enterprises
epson
equipment
ericsson
erni
esq
estate
eurovision
eus
events
exchange
expert
exposed
express
extraspace
fage
fail
fairwinds
faith
family
fan
fans
farm
farmers
fashion
fast
fedex
feedback
ferrari
ferrero
fidelity
fido
film
final
finance
financial
fire
firestone
firmdale
fish
fishing
fit
fitness
flickr
flights
flir
florist
flowers
fly
foo
food
football
ford
forex
forsale
forum
foundation
fox
free
fresenius
frl
frogans
frontier
ftr
fujitsu
fun
fund
furniture
futbol
fyi
gal
gallery
gallo
gallup
game
games
gap
garden
gay
gbiz
gdn
gea
gent
genting
george
ggee
gift
gifts
gives
giving
glass
gle
global
globo
gmail
gmbh
gmo
gmx
godaddy
gold
goldpoint
golf
goodyear
goog
google
gop
got
grainger
graphics
gratis
green
gripe
grocery
group
gucci
guge
guide
guitars
guru
hair
hamburg
hangout
haus
hbo
hdfc
hdfcbank
health
healthcare
help
here
hermes
hiphop
hisamitsu
hitachi
hiv
hkt
hockey
holdings
holiday
homedepot
homegoods
homes
homesense
honda
horse
hospital
host
hosting
hot
hotel
hotels
hotmail
house
how
hsbc
hughes
hyatt
hyundai
ibm
icbc
ice
icu
ieee
ifm
ikano
imamat
imdb
immo
immobilien
inc
industries
infiniti
ing
ink
institute
insurance
insure
international
intuit
investments
ipiranga
irish
ismaili
ist
istanbul
itau
itv
jaguar
java
jcb
jeep
jetzt
jewelry
jio
jll
jmp
jnj
joburg
jot
joy
jpmorgan
jprs
juegos
kaufen
kddi
kerryhotels
kerryproperties
kfh
kia
kids
kim
kindle
kitchen
kiwi
koeln
komatsu
kosher
kpmg
kpn
krd
kred
kuokgroup
kyoto
lacaixa
lamborghini
lamer
land
landrover
lanxess
lasalle
lat
latino
latrobe
law
lawyer
lds
lease
leclerc
lefrak
legal
lego
lexus
lgbt
lidl
life
lifeinsurance
lifestyle
lighting
like
lilly
limited
limo
lincoln
link
live
living
llc
llp
loan
loans
locker
locus
lol
london
lotte
lotto
love
lpl
lplfinancial
ltd
ltda
lundbeck
luxe
luxury
madrid
maif
maison
makeup
man
management
mango
map
market
marketing
markets
marriott
marshalls
mattel
mba
mckinsey
med
media
meet
melbourne
meme
memorial
men
menu
merck
merckmsd
miami
microsoft
mini
mint
mit
mitsubishi
mlb
mls
mma
mobile
moda
moe
moi
mom
monash
money
monster
mormon
mortgage
moscow
moto
motorcycles
mov
movie
msd
mtn
mtr
music
nab
nagoya
navy
nba
nec
netbank
netflix
network
neustar
new
news
next
nextdirect
nexus
nfl
ngo
nhk
nico
nike
nikon
ninja
nissan
nissay
nokia
norton
now
nowruz
nowtv
nra
nrw
ntt
nyc
obi
observer
office
okinawa
olayan
olayangroup
ollo
omega
one
ong
onl
online
ooo
open
oracle
orange
organic
origins
osaka
otsuka
ott
ovh
page
panasonic
paris
pars
partners
parts
party
pay
pccw
pet
pfizer
pharmacy
phd
philips
phone
photo
photography
photos
physio
pics
pictet
pictures
pid
pin
ping
pink
pioneer
pizza
place
play
playstation
plumbing
plus
pnc
pohl
poker
politie
porn
praxi
press
prime
prod
productions
prof
progressive
promo
properties
property
protection
pru
prudential
pub
pwc
qpon
quebec
quest
racing
radio
read
realestate
realtor
realty
recipes
red
redumbrella
rehab
reise
reisen
reit
reliance
ren
rent
rentals
repair
report
republican
rest
restaurant
review
reviews
rexroth
rich
richardli
ricoh
ril
rio
rip
rocks
rodeo
rogers
room
rsvp
rugby
ruhr
run
rwe
ryukyu
saarland
safe
safety
sakura
sale
salon
samsclub
samsung
sandvik
sandvikcoromant
sanofi
sap
sarl
sas
save
saxo
sbi
sbs
scb
schaeffler
schmidt
scholarships
school
schule
schwarz
science
scot
search
seat
secure
security
seek
select
sener
services
seven
sew
sex
sexy
sfr
shangrila
sharp
shell
shia
shiksha
shoes
shop
shopping
shouji
show
silk
sina
singles
site
ski
skin
sky
skype
sling
smart
smile
sncf
soccer
social
softbank
software
sohu
solar
solutions
song
sony
soy
spa
space
sport
spot
srl
stada
staples
star
statebank
statefarm
stc
stcgroup
stockholm
storage
store
stream
studio
study
style
sucks
supplies
supply
support
surf
surgery
suzuki
swatch
swiss
sydney
systems
tab
taipei
talk
taobao
target
tatamotors
tatar
tattoo
tax
taxi
tci
tdk
team
tech
technology
temasek
tennis
teva
thd
theater
theatre
tiaa
tickets
tienda
tips
tires
tirol
tjmaxx
tjx
tkmaxx
tmall
today
tokyo
tools
top
toray
toshiba
total
tours
town
toyota
toys
trade
trading
training
travel
travelers
travelersinsurance
trust
trv
tube
tui
tunes
tushu
tvs
ubank
ubs
unicom
university
uno
uol
ups
vacations
vana
vanguard
vegas
ventures
verisign
versicherung
vet
viajes
video
vig
viking
villas
vin
vip
virgin
visa
vision
viva
vivo
vlaanderen
vodka
volvo
vote
voting
voto
voyage
wales
walmart
walter
wang
wanggou
watch
watches
weather
weatherchannel
web
webcam
weber
website
wed
wedding
weibo
weir
whoswho
wien
wiki
williamhill
win
windows
wine
winners
wme
woodside
work
works
world
wow
wtc
wtf
xbox
xerox
xihuan
xin
\u0915\u0949\u092E
\u30BB\u30FC\u30EB
\u4F5B\u5C71
\u6148\u5584
\u96C6\u56E2
\u5728\u7EBF
\u70B9\u770B
\u0E04\u0E2D\u0E21
\u516B\u5366
\u0645\u0648\u0642\u0639
\u516C\u76CA
\u516C\u53F8
\u9999\u683C\u91CC\u62C9
\u7F51\u7AD9
\u79FB\u52A8
\u6211\u7231\u4F60
\u043C\u043E\u0441\u043A\u0432\u0430
\u043A\u0430\u0442\u043E\u043B\u0438\u043A
\u043E\u043D\u043B\u0430\u0439\u043D
\u0441\u0430\u0439\u0442
\u8054\u901A
\u05E7\u05D5\u05DD
\u65F6\u5C1A
\u5FAE\u535A
\u6DE1\u9A6C\u9521
\u30D5\u30A1\u30C3\u30B7\u30E7\u30F3
\u043E\u0440\u0433
\u0928\u0947\u091F
\u30B9\u30C8\u30A2
\u30A2\u30DE\u30BE\u30F3
\uC0BC\uC131
\u5546\u6807
\u5546\u5E97
\u5546\u57CE
\u0434\u0435\u0442\u0438
\u30DD\u30A4\u30F3\u30C8
\u65B0\u95FB
\u5BB6\u96FB
\u0643\u0648\u0645
\u4E2D\u6587\u7F51
\u4E2D\u4FE1
\u5A31\u4E50
\u8C37\u6B4C
\u96FB\u8A0A\u76C8\u79D1
\u8D2D\u7269
\u30AF\u30E9\u30A6\u30C9
\u901A\u8CA9
\u7F51\u5E97
\u0938\u0902\u0917\u0920\u0928
\u9910\u5385
\u7F51\u7EDC
\u043A\u043E\u043C
\u4E9A\u9A6C\u900A
\u98DF\u54C1
\u98DE\u5229\u6D66
\u624B\u673A
\u0627\u0631\u0627\u0645\u0643\u0648
\u0627\u0644\u0639\u0644\u064A\u0627\u0646
\u0628\u0627\u0632\u0627\u0631
\u0627\u0628\u0648\u0638\u0628\u064A
\u0643\u0627\u062B\u0648\u0644\u064A\u0643
\u0647\u0645\u0631\u0627\u0647
\uB2F7\uCEF4
\u653F\u5E9C
\u0634\u0628\u0643\u0629
\u0628\u064A\u062A\u0643
\u0639\u0631\u0628
\u673A\u6784
\u7EC4\u7EC7\u673A\u6784
\u5065\u5EB7
\u62DB\u8058
\u0440\u0443\u0441
\u5927\u62FF
\u307F\u3093\u306A
\u30B0\u30FC\u30B0\u30EB
\u4E16\u754C
\u66F8\u7C4D
\u7F51\u5740
\uB2F7\uB137
\u30B3\u30E0
\u5929\u4E3B\u6559
\u6E38\u620F
verm\xF6gensberater
verm\xF6gensberatung
\u4F01\u4E1A
\u4FE1\u606F
\u5609\u91CC\u5927\u9152\u5E97
\u5609\u91CC
\u5E7F\u4E1C
\u653F\u52A1
xyz
yachts
yahoo
yamaxun
yandex
yodobashi
yoga
yokohama
you
youtube
yun
zappos
zara
zero
zip
zone
zuerich
co.krd
edu.krd
art.pl
gliwice.pl
krakow.pl
poznan.pl
wroc.pl
zakopane.pl
cc.ua
inf.ua
ltd.ua
611.to
a2hosted.com
cpserver.com
abyme.dev
activetrail.biz
myaddr.dev
myaddr.io
dyn.addr.tools
myaddr.tools
adobeaemcloud.com
*.dev.adobeaemcloud.com
aem.live
hlx.live
adobeaemcloud.net
aem.network
aem.page
hlx.page
aem.reviews
adobeio-static.net
adobeioruntime.net
africa.com
*.auiusercontent.com
beep.pl
aiven.app
*.aivencloud.com
akadns.net
akamai.net
akamai-staging.net
akamaiedge.net
akamaiedge-staging.net
akamaihd.net
akamaihd-staging.net
akamaiorigin.net
akamaiorigin-staging.net
akamaized.net
akamaized-staging.net
edgekey.net
edgekey-staging.net
edgesuite.net
edgesuite-staging.net
barsy.ca
*.compute.estate
*.alces.network
alibabacloudcs.com
*.ztna-dingtalk.com
ms.fun
ms.show
kasserver.com
altervista.org
alwaysdata.net
myamaze.net
execute-api.cn-north-1.amazonaws.com.cn
execute-api.cn-northwest-1.amazonaws.com.cn
execute-api.af-south-1.amazonaws.com
execute-api.ap-east-1.amazonaws.com
execute-api.ap-northeast-1.amazonaws.com
execute-api.ap-northeast-2.amazonaws.com
execute-api.ap-northeast-3.amazonaws.com
execute-api.ap-south-1.amazonaws.com
execute-api.ap-south-2.amazonaws.com
execute-api.ap-southeast-1.amazonaws.com
execute-api.ap-southeast-2.amazonaws.com
execute-api.ap-southeast-3.amazonaws.com
execute-api.ap-southeast-4.amazonaws.com
execute-api.ap-southeast-5.amazonaws.com
execute-api.ca-central-1.amazonaws.com
execute-api.ca-west-1.amazonaws.com
execute-api.eu-central-1.amazonaws.com
execute-api.eu-central-2.amazonaws.com
execute-api.eu-north-1.amazonaws.com
execute-api.eu-south-1.amazonaws.com
execute-api.eu-south-2.amazonaws.com
execute-api.eu-west-1.amazonaws.com
execute-api.eu-west-2.amazonaws.com
execute-api.eu-west-3.amazonaws.com
execute-api.il-central-1.amazonaws.com
execute-api.me-central-1.amazonaws.com
execute-api.me-south-1.amazonaws.com
execute-api.sa-east-1.amazonaws.com
execute-api.us-east-1.amazonaws.com
execute-api.us-east-2.amazonaws.com
execute-api.us-gov-east-1.amazonaws.com
execute-api.us-gov-west-1.amazonaws.com
execute-api.us-west-1.amazonaws.com
execute-api.us-west-2.amazonaws.com
consent-portal.bedrock-agentcore.ap-northeast-1.amazonaws.com
consent-portal.bedrock-agentcore.ap-northeast-2.amazonaws.com
consent-portal.bedrock-agentcore.ap-south-1.amazonaws.com
consent-portal.bedrock-agentcore.ap-south-2.amazonaws.com
consent-portal.bedrock-agentcore.ap-southeast-1.amazonaws.com
consent-portal.bedrock-agentcore.ap-southeast-2.amazonaws.com
consent-portal.bedrock-agentcore.ap-southeast-5.amazonaws.com
consent-portal.bedrock-agentcore.ap-southeast-7.amazonaws.com
consent-portal.bedrock-agentcore.ca-central-1.amazonaws.com
consent-portal.bedrock-agentcore.eu-central-1.amazonaws.com
consent-portal.bedrock-agentcore.eu-north-1.amazonaws.com
consent-portal.bedrock-agentcore.eu-south-1.amazonaws.com
consent-portal.bedrock-agentcore.eu-south-2.amazonaws.com
consent-portal.bedrock-agentcore.eu-west-1.amazonaws.com
consent-portal.bedrock-agentcore.eu-west-2.amazonaws.com
consent-portal.bedrock-agentcore.eu-west-3.amazonaws.com
consent-portal.bedrock-agentcore.sa-east-1.amazonaws.com
consent-portal.bedrock-agentcore.us-east-1.amazonaws.com
consent-portal.bedrock-agentcore.us-east-2.amazonaws.com
consent-portal.bedrock-agentcore.us-gov-west-1.amazonaws.com
consent-portal.bedrock-agentcore.us-west-1.amazonaws.com
consent-portal.bedrock-agentcore.us-west-2.amazonaws.com
cloudfront.net
auth.af-south-1.amazoncognito.com
auth.ap-east-1.amazoncognito.com
auth.ap-east-2.amazoncognito.com
auth.ap-northeast-1.amazoncognito.com
auth.ap-northeast-2.amazoncognito.com
auth.ap-northeast-3.amazoncognito.com
auth.ap-south-1.amazoncognito.com
auth.ap-south-2.amazoncognito.com
auth.ap-southeast-1.amazoncognito.com
auth.ap-southeast-2.amazoncognito.com
auth.ap-southeast-3.amazoncognito.com
auth.ap-southeast-4.amazoncognito.com
auth.ap-southeast-5.amazoncognito.com
auth.ap-southeast-6.amazoncognito.com
auth.ap-southeast-7.amazoncognito.com
auth.ca-central-1.amazoncognito.com
auth.ca-west-1.amazoncognito.com
auth.eu-central-1.amazoncognito.com
auth.eu-central-2.amazoncognito.com
auth.eu-north-1.amazoncognito.com
auth.eu-south-1.amazoncognito.com
auth.eu-south-2.amazoncognito.com
auth.eu-west-1.amazoncognito.com
auth.eu-west-2.amazoncognito.com
auth.eu-west-3.amazoncognito.com
auth.il-central-1.amazoncognito.com
auth.me-central-1.amazoncognito.com
auth.me-south-1.amazoncognito.com
auth.mx-central-1.amazoncognito.com
auth.sa-east-1.amazoncognito.com
auth.us-east-1.amazoncognito.com
auth-fips.us-east-1.amazoncognito.com
auth.us-east-2.amazoncognito.com
auth-fips.us-east-2.amazoncognito.com
auth-fips.us-gov-east-1.amazoncognito.com
auth-fips.us-gov-west-1.amazoncognito.com
auth.us-west-1.amazoncognito.com
auth-fips.us-west-1.amazoncognito.com
auth.us-west-2.amazoncognito.com
auth-fips.us-west-2.amazoncognito.com
auth.cognito-idp.eusc-de-east-1.on.amazonwebservices.eu
*.compute.amazonaws.com.cn
*.compute.amazonaws.com
*.compute-1.amazonaws.com
us-east-1.amazonaws.com
emrappui-prod.cn-north-1.amazonaws.com.cn
emrnotebooks-prod.cn-north-1.amazonaws.com.cn
emrstudio-prod.cn-north-1.amazonaws.com.cn
emrappui-prod.cn-northwest-1.amazonaws.com.cn
emrnotebooks-prod.cn-northwest-1.amazonaws.com.cn
emrstudio-prod.cn-northwest-1.amazonaws.com.cn
emrappui-prod.af-south-1.amazonaws.com
emrnotebooks-prod.af-south-1.amazonaws.com
emrstudio-prod.af-south-1.amazonaws.com
emrappui-prod.ap-east-1.amazonaws.com
emrnotebooks-prod.ap-east-1.amazonaws.com
emrstudio-prod.ap-east-1.amazonaws.com
emrappui-prod.ap-northeast-1.amazonaws.com
emrnotebooks-prod.ap-northeast-1.amazonaws.com
emrstudio-prod.ap-northeast-1.amazonaws.com
emrappui-prod.ap-northeast-2.amazonaws.com
emrnotebooks-prod.ap-northeast-2.amazonaws.com
emrstudio-prod.ap-northeast-2.amazonaws.com
emrappui-prod.ap-northeast-3.amazonaws.com
emrnotebooks-prod.ap-northeast-3.amazonaws.com
emrstudio-prod.ap-northeast-3.amazonaws.com
emrappui-prod.ap-south-1.amazonaws.com
emrnotebooks-prod.ap-south-1.amazonaws.com
emrstudio-prod.ap-south-1.amazonaws.com
emrappui-prod.ap-south-2.amazonaws.com
emrnotebooks-prod.ap-south-2.amazonaws.com
emrstudio-prod.ap-south-2.amazonaws.com
emrappui-prod.ap-southeast-1.amazonaws.com
emrnotebooks-prod.ap-southeast-1.amazonaws.com
emrstudio-prod.ap-southeast-1.amazonaws.com
emrappui-prod.ap-southeast-2.amazonaws.com
emrnotebooks-prod.ap-southeast-2.amazonaws.com
emrstudio-prod.ap-southeast-2.amazonaws.com
emrappui-prod.ap-southeast-3.amazonaws.com
emrnotebooks-prod.ap-southeast-3.amazonaws.com
emrstudio-prod.ap-southeast-3.amazonaws.com
emrappui-prod.ap-southeast-4.amazonaws.com
emrnotebooks-prod.ap-southeast-4.amazonaws.com
emrstudio-prod.ap-southeast-4.amazonaws.com
emrappui-prod.ca-central-1.amazonaws.com
emrnotebooks-prod.ca-central-1.amazonaws.com
emrstudio-prod.ca-central-1.amazonaws.com
emrappui-prod.ca-west-1.amazonaws.com
emrnotebooks-prod.ca-west-1.amazonaws.com
emrstudio-prod.ca-west-1.amazonaws.com
emrappui-prod.eu-central-1.amazonaws.com
emrnotebooks-prod.eu-central-1.amazonaws.com
emrstudio-prod.eu-central-1.amazonaws.com
emrappui-prod.eu-central-2.amazonaws.com
emrnotebooks-prod.eu-central-2.amazonaws.com
emrstudio-prod.eu-central-2.amazonaws.com
emrappui-prod.eu-north-1.amazonaws.com
emrnotebooks-prod.eu-north-1.amazonaws.com
emrstudio-prod.eu-north-1.amazonaws.com
emrappui-prod.eu-south-1.amazonaws.com
emrnotebooks-prod.eu-south-1.amazonaws.com
emrstudio-prod.eu-south-1.amazonaws.com
emrappui-prod.eu-south-2.amazonaws.com
emrnotebooks-prod.eu-south-2.amazonaws.com
emrstudio-prod.eu-south-2.amazonaws.com
emrappui-prod.eu-west-1.amazonaws.com
emrnotebooks-prod.eu-west-1.amazonaws.com
emrstudio-prod.eu-west-1.amazonaws.com
emrappui-prod.eu-west-2.amazonaws.com
emrnotebooks-prod.eu-west-2.amazonaws.com
emrstudio-prod.eu-west-2.amazonaws.com
emrappui-prod.eu-west-3.amazonaws.com
emrnotebooks-prod.eu-west-3.amazonaws.com
emrstudio-prod.eu-west-3.amazonaws.com
emrappui-prod.il-central-1.amazonaws.com
emrnotebooks-prod.il-central-1.amazonaws.com
emrstudio-prod.il-central-1.amazonaws.com
emrappui-prod.me-central-1.amazonaws.com
emrnotebooks-prod.me-central-1.amazonaws.com
emrstudio-prod.me-central-1.amazonaws.com
emrappui-prod.me-south-1.amazonaws.com
emrnotebooks-prod.me-south-1.amazonaws.com
emrstudio-prod.me-south-1.amazonaws.com
emrappui-prod.sa-east-1.amazonaws.com
emrnotebooks-prod.sa-east-1.amazonaws.com
emrstudio-prod.sa-east-1.amazonaws.com
emrappui-prod.us-east-1.amazonaws.com
emrnotebooks-prod.us-east-1.amazonaws.com
emrstudio-prod.us-east-1.amazonaws.com
emrappui-prod.us-east-2.amazonaws.com
emrnotebooks-prod.us-east-2.amazonaws.com
emrstudio-prod.us-east-2.amazonaws.com
emrappui-prod.us-gov-east-1.amazonaws.com
emrnotebooks-prod.us-gov-east-1.amazonaws.com
emrstudio-prod.us-gov-east-1.amazonaws.com
emrappui-prod.us-gov-west-1.amazonaws.com
emrnotebooks-prod.us-gov-west-1.amazonaws.com
emrstudio-prod.us-gov-west-1.amazonaws.com
emrappui-prod.us-west-1.amazonaws.com
emrnotebooks-prod.us-west-1.amazonaws.com
emrstudio-prod.us-west-1.amazonaws.com
emrappui-prod.us-west-2.amazonaws.com
emrnotebooks-prod.us-west-2.amazonaws.com
emrstudio-prod.us-west-2.amazonaws.com
amazonlightsail.com
*.ap-east-1.cs.amazonlightsail.com
*.ap-northeast-1.cs.amazonlightsail.com
*.ap-northeast-2.cs.amazonlightsail.com
*.ap-south-1.cs.amazonlightsail.com
*.ap-southeast-1.cs.amazonlightsail.com
*.ap-southeast-2.cs.amazonlightsail.com
*.ap-southeast-3.cs.amazonlightsail.com
*.ap-southeast-5.cs.amazonlightsail.com
*.ca-central-1.cs.amazonlightsail.com
*.eu-central-1.cs.amazonlightsail.com
*.eu-north-1.cs.amazonlightsail.com
*.eu-south-2.cs.amazonlightsail.com
*.eu-west-1.cs.amazonlightsail.com
*.eu-west-2.cs.amazonlightsail.com
*.eu-west-3.cs.amazonlightsail.com
*.sa-east-1.cs.amazonlightsail.com
*.us-east-1.cs.amazonlightsail.com
*.us-east-2.cs.amazonlightsail.com
*.us-west-2.cs.amazonlightsail.com
*.airflow.af-south-1.on.aws
*.airflow.ap-east-1.on.aws
*.airflow.ap-northeast-1.on.aws
*.airflow.ap-northeast-2.on.aws
*.airflow.ap-northeast-3.on.aws
*.airflow.ap-south-1.on.aws
*.airflow.ap-south-2.on.aws
*.airflow.ap-southeast-1.on.aws
*.airflow.ap-southeast-2.on.aws
*.airflow.ap-southeast-3.on.aws
*.airflow.ap-southeast-4.on.aws
*.airflow.ap-southeast-5.on.aws
*.airflow.ap-southeast-7.on.aws
*.airflow.ca-central-1.on.aws
*.airflow.ca-west-1.on.aws
*.airflow.eu-central-1.on.aws
*.airflow.eu-central-2.on.aws
*.airflow.eu-north-1.on.aws
*.airflow.eu-south-1.on.aws
*.airflow.eu-south-2.on.aws
*.airflow.eu-west-1.on.aws
*.airflow.eu-west-2.on.aws
*.airflow.eu-west-3.on.aws
*.airflow.il-central-1.on.aws
*.airflow.me-central-1.on.aws
*.airflow.me-south-1.on.aws
*.airflow.sa-east-1.on.aws
*.airflow.us-east-1.on.aws
*.airflow.us-east-2.on.aws
*.airflow.us-west-1.on.aws
*.airflow.us-west-2.on.aws
*.cn-north-1.airflow.amazonaws.com.cn
*.cn-northwest-1.airflow.amazonaws.com.cn
*.airflow.cn-north-1.on.amazonwebservices.com.cn
*.airflow.cn-northwest-1.on.amazonwebservices.com.cn
*.af-south-1.airflow.amazonaws.com
*.ap-east-1.airflow.amazonaws.com
*.ap-northeast-1.airflow.amazonaws.com
*.ap-northeast-2.airflow.amazonaws.com
*.ap-northeast-3.airflow.amazonaws.com
*.ap-south-1.airflow.amazonaws.com
*.ap-south-2.airflow.amazonaws.com
*.ap-southeast-1.airflow.amazonaws.com
*.ap-southeast-2.airflow.amazonaws.com
*.ap-southeast-3.airflow.amazonaws.com
*.ap-southeast-4.airflow.amazonaws.com
*.ap-southeast-5.airflow.amazonaws.com
*.ap-southeast-7.airflow.amazonaws.com
*.ca-central-1.airflow.amazonaws.com
*.ca-west-1.airflow.amazonaws.com
*.eu-central-1.airflow.amazonaws.com
*.eu-central-2.airflow.amazonaws.com
*.eu-north-1.airflow.amazonaws.com
*.eu-south-1.airflow.amazonaws.com
*.eu-south-2.airflow.amazonaws.com
*.eu-west-1.airflow.amazonaws.com
*.eu-west-2.airflow.amazonaws.com
*.eu-west-3.airflow.amazonaws.com
*.il-central-1.airflow.amazonaws.com
*.me-central-1.airflow.amazonaws.com
*.me-south-1.airflow.amazonaws.com
*.sa-east-1.airflow.amazonaws.com
*.us-east-1.airflow.amazonaws.com
*.us-east-2.airflow.amazonaws.com
*.us-west-1.airflow.amazonaws.com
*.us-west-2.airflow.amazonaws.com
*.rds.cn-north-1.amazonaws.com.cn
*.rds.cn-northwest-1.amazonaws.com.cn
*.af-south-1.rds.amazonaws.com
*.ap-east-1.rds.amazonaws.com
*.ap-east-2.rds.amazonaws.com
*.ap-northeast-1.rds.amazonaws.com
*.ap-northeast-2.rds.amazonaws.com
*.ap-northeast-3.rds.amazonaws.com
*.ap-south-1.rds.amazonaws.com
*.ap-south-2.rds.amazonaws.com
*.ap-southeast-1.rds.amazonaws.com
*.ap-southeast-2.rds.amazonaws.com
*.ap-southeast-3.rds.amazonaws.com
*.ap-southeast-4.rds.amazonaws.com
*.ap-southeast-5.rds.amazonaws.com
*.ap-southeast-6.rds.amazonaws.com
*.ap-southeast-7.rds.amazonaws.com
*.ca-central-1.rds.amazonaws.com
*.ca-west-1.rds.amazonaws.com
*.eu-central-1.rds.amazonaws.com
*.eu-central-2.rds.amazonaws.com
*.eu-west-1.rds.amazonaws.com
*.eu-west-2.rds.amazonaws.com
*.eu-west-3.rds.amazonaws.com
*.il-central-1.rds.amazonaws.com
*.me-central-1.rds.amazonaws.com
*.me-south-1.rds.amazonaws.com
*.mx-central-1.rds.amazonaws.com
*.sa-east-1.rds.amazonaws.com
*.us-east-1.rds.amazonaws.com
*.us-east-2.rds.amazonaws.com
*.us-gov-east-1.rds.amazonaws.com
*.us-gov-west-1.rds.amazonaws.com
*.us-northeast-1.rds.amazonaws.com
*.us-west-1.rds.amazonaws.com
*.us-west-2.rds.amazonaws.com
s3.dualstack.cn-north-1.amazonaws.com.cn
s3-accesspoint.dualstack.cn-north-1.amazonaws.com.cn
s3-website.dualstack.cn-north-1.amazonaws.com.cn
s3.cn-north-1.amazonaws.com.cn
s3-accesspoint.cn-north-1.amazonaws.com.cn
s3-deprecated.cn-north-1.amazonaws.com.cn
s3-object-lambda.cn-north-1.amazonaws.com.cn
s3-website.cn-north-1.amazonaws.com.cn
s3.dualstack.cn-northwest-1.amazonaws.com.cn
s3-accesspoint.dualstack.cn-northwest-1.amazonaws.com.cn
s3.cn-northwest-1.amazonaws.com.cn
s3-accesspoint.cn-northwest-1.amazonaws.com.cn
s3-object-lambda.cn-northwest-1.amazonaws.com.cn
s3-website.cn-northwest-1.amazonaws.com.cn
s3.dualstack.af-south-1.amazonaws.com
s3-accesspoint.dualstack.af-south-1.amazonaws.com
s3-website.dualstack.af-south-1.amazonaws.com
s3.af-south-1.amazonaws.com
s3-accesspoint.af-south-1.amazonaws.com
s3-object-lambda.af-south-1.amazonaws.com
s3-website.af-south-1.amazonaws.com
s3.dualstack.ap-east-1.amazonaws.com
s3-accesspoint.dualstack.ap-east-1.amazonaws.com
s3.ap-east-1.amazonaws.com
s3-accesspoint.ap-east-1.amazonaws.com
s3-object-lambda.ap-east-1.amazonaws.com
s3-website.ap-east-1.amazonaws.com
s3.dualstack.ap-northeast-1.amazonaws.com
s3-accesspoint.dualstack.ap-northeast-1.amazonaws.com
s3-website.dualstack.ap-northeast-1.amazonaws.com
s3.ap-northeast-1.amazonaws.com
s3-accesspoint.ap-northeast-1.amazonaws.com
s3-object-lambda.ap-northeast-1.amazonaws.com
s3-website.ap-northeast-1.amazonaws.com
s3.dualstack.ap-northeast-2.amazonaws.com
s3-accesspoint.dualstack.ap-northeast-2.amazonaws.com
s3-website.dualstack.ap-northeast-2.amazonaws.com
s3.ap-northeast-2.amazonaws.com
s3-accesspoint.ap-northeast-2.amazonaws.com
s3-object-lambda.ap-northeast-2.amazonaws.com
s3-website.ap-northeast-2.amazonaws.com
s3.dualstack.ap-northeast-3.amazonaws.com
s3-accesspoint.dualstack.ap-northeast-3.amazonaws.com
s3-website.dualstack.ap-northeast-3.amazonaws.com
s3.ap-northeast-3.amazonaws.com
s3-accesspoint.ap-northeast-3.amazonaws.com
s3-object-lambda.ap-northeast-3.amazonaws.com
s3-website.ap-northeast-3.amazonaws.com
s3.dualstack.ap-south-1.amazonaws.com
s3-accesspoint.dualstack.ap-south-1.amazonaws.com
s3-website.dualstack.ap-south-1.amazonaws.com
s3.ap-south-1.amazonaws.com
s3-accesspoint.ap-south-1.amazonaws.com
s3-object-lambda.ap-south-1.amazonaws.com
s3-website.ap-south-1.amazonaws.com
s3.dualstack.ap-south-2.amazonaws.com
s3-accesspoint.dualstack.ap-south-2.amazonaws.com
s3-website.dualstack.ap-south-2.amazonaws.com
s3.ap-south-2.amazonaws.com
s3-accesspoint.ap-south-2.amazonaws.com
s3-object-lambda.ap-south-2.amazonaws.com
s3-website.ap-south-2.amazonaws.com
s3.dualstack.ap-southeast-1.amazonaws.com
s3-accesspoint.dualstack.ap-southeast-1.amazonaws.com
s3-website.dualstack.ap-southeast-1.amazonaws.com
s3.ap-southeast-1.amazonaws.com
s3-accesspoint.ap-southeast-1.amazonaws.com
s3-object-lambda.ap-southeast-1.amazonaws.com
s3-website.ap-southeast-1.amazonaws.com
s3.dualstack.ap-southeast-2.amazonaws.com
s3-accesspoint.dualstack.ap-southeast-2.amazonaws.com
s3-website.dualstack.ap-southeast-2.amazonaws.com
s3.ap-southeast-2.amazonaws.com
s3-accesspoint.ap-southeast-2.amazonaws.com
s3-object-lambda.ap-southeast-2.amazonaws.com
s3-website.ap-southeast-2.amazonaws.com
s3.dualstack.ap-southeast-3.amazonaws.com
s3-accesspoint.dualstack.ap-southeast-3.amazonaws.com
s3-website.dualstack.ap-southeast-3.amazonaws.com
s3.ap-southeast-3.amazonaws.com
s3-accesspoint.ap-southeast-3.amazonaws.com
s3-object-lambda.ap-southeast-3.amazonaws.com
s3-website.ap-southeast-3.amazonaws.com
s3.dualstack.ap-southeast-4.amazonaws.com
s3-accesspoint.dualstack.ap-southeast-4.amazonaws.com
s3-website.dualstack.ap-southeast-4.amazonaws.com
s3.ap-southeast-4.amazonaws.com
s3-accesspoint.ap-southeast-4.amazonaws.com
s3-object-lambda.ap-southeast-4.amazonaws.com
s3-website.ap-southeast-4.amazonaws.com
s3.dualstack.ap-southeast-5.amazonaws.com
s3-accesspoint.dualstack.ap-southeast-5.amazonaws.com
s3-website.dualstack.ap-southeast-5.amazonaws.com
s3.ap-southeast-5.amazonaws.com
s3-accesspoint.ap-southeast-5.amazonaws.com
s3-deprecated.ap-southeast-5.amazonaws.com
s3-object-lambda.ap-southeast-5.amazonaws.com
s3-website.ap-southeast-5.amazonaws.com
s3.dualstack.ca-central-1.amazonaws.com
s3-accesspoint.dualstack.ca-central-1.amazonaws.com
s3-accesspoint-fips.dualstack.ca-central-1.amazonaws.com
s3-fips.dualstack.ca-central-1.amazonaws.com
s3-website.dualstack.ca-central-1.amazonaws.com
s3.ca-central-1.amazonaws.com
s3-accesspoint.ca-central-1.amazonaws.com
s3-accesspoint-fips.ca-central-1.amazonaws.com
s3-fips.ca-central-1.amazonaws.com
s3-object-lambda.ca-central-1.amazonaws.com
s3-website.ca-central-1.amazonaws.com
s3.dualstack.ca-west-1.amazonaws.com
s3-accesspoint.dualstack.ca-west-1.amazonaws.com
s3-accesspoint-fips.dualstack.ca-west-1.amazonaws.com
s3-fips.dualstack.ca-west-1.amazonaws.com
s3-website.dualstack.ca-west-1.amazonaws.com
s3.ca-west-1.amazonaws.com
s3-accesspoint.ca-west-1.amazonaws.com
s3-accesspoint-fips.ca-west-1.amazonaws.com
s3-fips.ca-west-1.amazonaws.com
s3-object-lambda.ca-west-1.amazonaws.com
s3-website.ca-west-1.amazonaws.com
s3.dualstack.eu-central-1.amazonaws.com
s3-accesspoint.dualstack.eu-central-1.amazonaws.com
s3-website.dualstack.eu-central-1.amazonaws.com
s3.eu-central-1.amazonaws.com
s3-accesspoint.eu-central-1.amazonaws.com
s3-object-lambda.eu-central-1.amazonaws.com
s3-website.eu-central-1.amazonaws.com
s3.dualstack.eu-central-2.amazonaws.com
s3-accesspoint.dualstack.eu-central-2.amazonaws.com
s3-website.dualstack.eu-central-2.amazonaws.com
s3.eu-central-2.amazonaws.com
s3-accesspoint.eu-central-2.amazonaws.com
s3-object-lambda.eu-central-2.amazonaws.com
s3-website.eu-central-2.amazonaws.com
s3.dualstack.eu-north-1.amazonaws.com
s3-accesspoint.dualstack.eu-north-1.amazonaws.com
s3.eu-north-1.amazonaws.com
s3-accesspoint.eu-north-1.amazonaws.com
s3-object-lambda.eu-north-1.amazonaws.com
s3-website.eu-north-1.amazonaws.com
s3.dualstack.eu-south-1.amazonaws.com
s3-accesspoint.dualstack.eu-south-1.amazonaws.com
s3-website.dualstack.eu-south-1.amazonaws.com
s3.eu-south-1.amazonaws.com
s3-accesspoint.eu-south-1.amazonaws.com
s3-object-lambda.eu-south-1.amazonaws.com
s3-website.eu-south-1.amazonaws.com
s3.dualstack.eu-south-2.amazonaws.com
s3-accesspoint.dualstack.eu-south-2.amazonaws.com
s3-website.dualstack.eu-south-2.amazonaws.com
s3.eu-south-2.amazonaws.com
s3-accesspoint.eu-south-2.amazonaws.com
s3-object-lambda.eu-south-2.amazonaws.com
s3-website.eu-south-2.amazonaws.com
s3.dualstack.eu-west-1.amazonaws.com
s3-accesspoint.dualstack.eu-west-1.amazonaws.com
s3-website.dualstack.eu-west-1.amazonaws.com
s3.eu-west-1.amazonaws.com
s3-accesspoint.eu-west-1.amazonaws.com
s3-deprecated.eu-west-1.amazonaws.com
s3-object-lambda.eu-west-1.amazonaws.com
s3-website.eu-west-1.amazonaws.com
s3.dualstack.eu-west-2.amazonaws.com
s3-accesspoint.dualstack.eu-west-2.amazonaws.com
s3.eu-west-2.amazonaws.com
s3-accesspoint.eu-west-2.amazonaws.com
s3-object-lambda.eu-west-2.amazonaws.com
s3-website.eu-west-2.amazonaws.com
s3.dualstack.eu-west-3.amazonaws.com
s3-accesspoint.dualstack.eu-west-3.amazonaws.com
s3-website.dualstack.eu-west-3.amazonaws.com
s3.eu-west-3.amazonaws.com
s3-accesspoint.eu-west-3.amazonaws.com
s3-object-lambda.eu-west-3.amazonaws.com
s3-website.eu-west-3.amazonaws.com
s3.dualstack.il-central-1.amazonaws.com
s3-accesspoint.dualstack.il-central-1.amazonaws.com
s3-website.dualstack.il-central-1.amazonaws.com
s3.il-central-1.amazonaws.com
s3-accesspoint.il-central-1.amazonaws.com
s3-object-lambda.il-central-1.amazonaws.com
s3-website.il-central-1.amazonaws.com
s3.dualstack.me-central-1.amazonaws.com
s3-accesspoint.dualstack.me-central-1.amazonaws.com
s3-website.dualstack.me-central-1.amazonaws.com
s3.me-central-1.amazonaws.com
s3-accesspoint.me-central-1.amazonaws.com
s3-object-lambda.me-central-1.amazonaws.com
s3-website.me-central-1.amazonaws.com
s3.dualstack.me-south-1.amazonaws.com
s3-accesspoint.dualstack.me-south-1.amazonaws.com
s3.me-south-1.amazonaws.com
s3-accesspoint.me-south-1.amazonaws.com
s3-object-lambda.me-south-1.amazonaws.com
s3-website.me-south-1.amazonaws.com
s3.amazonaws.com
s3-1.amazonaws.com
s3-ap-east-1.amazonaws.com
s3-ap-northeast-1.amazonaws.com
s3-ap-northeast-2.amazonaws.com
s3-ap-northeast-3.amazonaws.com
s3-ap-south-1.amazonaws.com
s3-ap-southeast-1.amazonaws.com
s3-ap-southeast-2.amazonaws.com
s3-ca-central-1.amazonaws.com
s3-eu-central-1.amazonaws.com
s3-eu-north-1.amazonaws.com
s3-eu-west-1.amazonaws.com
s3-eu-west-2.amazonaws.com
s3-eu-west-3.amazonaws.com
s3-external-1.amazonaws.com
s3-fips-us-gov-east-1.amazonaws.com
s3-fips-us-gov-west-1.amazonaws.com
mrap.accesspoint.s3-global.amazonaws.com
s3-me-south-1.amazonaws.com
s3-sa-east-1.amazonaws.com
s3-us-east-2.amazonaws.com
s3-us-gov-east-1.amazonaws.com
s3-us-gov-west-1.amazonaws.com
s3-us-west-1.amazonaws.com
s3-us-west-2.amazonaws.com
s3-website-ap-northeast-1.amazonaws.com
s3-website-ap-southeast-1.amazonaws.com
s3-website-ap-southeast-2.amazonaws.com
s3-website-eu-west-1.amazonaws.com
s3-website-sa-east-1.amazonaws.com
s3-website-us-east-1.amazonaws.com
s3-website-us-gov-west-1.amazonaws.com
s3-website-us-west-1.amazonaws.com
s3-website-us-west-2.amazonaws.com
s3.dualstack.sa-east-1.amazonaws.com
s3-accesspoint.dualstack.sa-east-1.amazonaws.com
s3-website.dualstack.sa-east-1.amazonaws.com
s3.sa-east-1.amazonaws.com
s3-accesspoint.sa-east-1.amazonaws.com
s3-object-lambda.sa-east-1.amazonaws.com
s3-website.sa-east-1.amazonaws.com
s3.dualstack.us-east-1.amazonaws.com
s3-accesspoint.dualstack.us-east-1.amazonaws.com
s3-accesspoint-fips.dualstack.us-east-1.amazonaws.com
s3-fips.dualstack.us-east-1.amazonaws.com
s3-website.dualstack.us-east-1.amazonaws.com
s3.us-east-1.amazonaws.com
s3-accesspoint.us-east-1.amazonaws.com
s3-accesspoint-fips.us-east-1.amazonaws.com
s3-deprecated.us-east-1.amazonaws.com
s3-fips.us-east-1.amazonaws.com
s3-object-lambda.us-east-1.amazonaws.com
s3-website.us-east-1.amazonaws.com
s3.dualstack.us-east-2.amazonaws.com
s3-accesspoint.dualstack.us-east-2.amazonaws.com
s3-accesspoint-fips.dualstack.us-east-2.amazonaws.com
s3-fips.dualstack.us-east-2.amazonaws.com
s3-website.dualstack.us-east-2.amazonaws.com
s3.us-east-2.amazonaws.com
s3-accesspoint.us-east-2.amazonaws.com
s3-accesspoint-fips.us-east-2.amazonaws.com
s3-deprecated.us-east-2.amazonaws.com
s3-fips.us-east-2.amazonaws.com
s3-object-lambda.us-east-2.amazonaws.com
s3-website.us-east-2.amazonaws.com
s3.dualstack.us-gov-east-1.amazonaws.com
s3-accesspoint.dualstack.us-gov-east-1.amazonaws.com
s3-accesspoint-fips.dualstack.us-gov-east-1.amazonaws.com
s3-fips.dualstack.us-gov-east-1.amazonaws.com
s3-website.dualstack.us-gov-east-1.amazonaws.com
s3.us-gov-east-1.amazonaws.com
s3-accesspoint.us-gov-east-1.amazonaws.com
s3-accesspoint-fips.us-gov-east-1.amazonaws.com
s3-fips.us-gov-east-1.amazonaws.com
s3-object-lambda.us-gov-east-1.amazonaws.com
s3-website.us-gov-east-1.amazonaws.com
s3.dualstack.us-gov-west-1.amazonaws.com
s3-accesspoint.dualstack.us-gov-west-1.amazonaws.com
s3-accesspoint-fips.dualstack.us-gov-west-1.amazonaws.com
s3-fips.dualstack.us-gov-west-1.amazonaws.com
s3-website.dualstack.us-gov-west-1.amazonaws.com
s3.us-gov-west-1.amazonaws.com
s3-accesspoint.us-gov-west-1.amazonaws.com
s3-accesspoint-fips.us-gov-west-1.amazonaws.com
s3-fips.us-gov-west-1.amazonaws.com
s3-object-lambda.us-gov-west-1.amazonaws.com
s3-website.us-gov-west-1.amazonaws.com
s3.dualstack.us-west-1.amazonaws.com
s3-accesspoint.dualstack.us-west-1.amazonaws.com
s3-accesspoint-fips.dualstack.us-west-1.amazonaws.com
s3-fips.dualstack.us-west-1.amazonaws.com
s3-website.dualstack.us-west-1.amazonaws.com
s3.us-west-1.amazonaws.com
s3-accesspoint.us-west-1.amazonaws.com
s3-accesspoint-fips.us-west-1.amazonaws.com
s3-fips.us-west-1.amazonaws.com
s3-object-lambda.us-west-1.amazonaws.com
s3-website.us-west-1.amazonaws.com
s3.dualstack.us-west-2.amazonaws.com
s3-accesspoint.dualstack.us-west-2.amazonaws.com
s3-accesspoint-fips.dualstack.us-west-2.amazonaws.com
s3-fips.dualstack.us-west-2.amazonaws.com
s3-website.dualstack.us-west-2.amazonaws.com
s3.us-west-2.amazonaws.com
s3-accesspoint.us-west-2.amazonaws.com
s3-accesspoint-fips.us-west-2.amazonaws.com
s3-deprecated.us-west-2.amazonaws.com
s3-fips.us-west-2.amazonaws.com
s3-object-lambda.us-west-2.amazonaws.com
s3-website.us-west-2.amazonaws.com
labeling.ap-northeast-1.sagemaker.aws
labeling.ap-northeast-2.sagemaker.aws
labeling.ap-south-1.sagemaker.aws
labeling.ap-southeast-1.sagemaker.aws
labeling.ap-southeast-2.sagemaker.aws
labeling.ca-central-1.sagemaker.aws
labeling.eu-central-1.sagemaker.aws
labeling.eu-west-1.sagemaker.aws
labeling.eu-west-2.sagemaker.aws
labeling.us-east-1.sagemaker.aws
labeling.us-east-2.sagemaker.aws
labeling.us-west-2.sagemaker.aws
notebook.af-south-1.sagemaker.aws
notebook.ap-east-1.sagemaker.aws
notebook.ap-northeast-1.sagemaker.aws
notebook.ap-northeast-2.sagemaker.aws
notebook.ap-northeast-3.sagemaker.aws
notebook.ap-south-1.sagemaker.aws
notebook.ap-south-2.sagemaker.aws
notebook.ap-southeast-1.sagemaker.aws
notebook.ap-southeast-2.sagemaker.aws
notebook.ap-southeast-3.sagemaker.aws
notebook.ap-southeast-4.sagemaker.aws
notebook.ca-central-1.sagemaker.aws
notebook-fips.ca-central-1.sagemaker.aws
notebook.ca-west-1.sagemaker.aws
notebook-fips.ca-west-1.sagemaker.aws
notebook.eu-central-1.sagemaker.aws
notebook.eu-central-2.sagemaker.aws
notebook.eu-north-1.sagemaker.aws
notebook.eu-south-1.sagemaker.aws
notebook.eu-south-2.sagemaker.aws
notebook.eu-west-1.sagemaker.aws
notebook.eu-west-2.sagemaker.aws
notebook.eu-west-3.sagemaker.aws
notebook.il-central-1.sagemaker.aws
notebook.me-central-1.sagemaker.aws
notebook.me-south-1.sagemaker.aws
notebook.sa-east-1.sagemaker.aws
notebook.us-east-1.sagemaker.aws
notebook-fips.us-east-1.sagemaker.aws
notebook.us-east-2.sagemaker.aws
notebook-fips.us-east-2.sagemaker.aws
notebook.us-gov-east-1.sagemaker.aws
notebook-fips.us-gov-east-1.sagemaker.aws
notebook.us-gov-west-1.sagemaker.aws
notebook-fips.us-gov-west-1.sagemaker.aws
notebook.us-west-1.sagemaker.aws
notebook-fips.us-west-1.sagemaker.aws
notebook.us-west-2.sagemaker.aws
notebook-fips.us-west-2.sagemaker.aws
notebook.cn-north-1.sagemaker.com.cn
notebook.cn-northwest-1.sagemaker.com.cn
studio.af-south-1.sagemaker.aws
studio.ap-east-1.sagemaker.aws
studio.ap-northeast-1.sagemaker.aws
studio.ap-northeast-2.sagemaker.aws
studio.ap-northeast-3.sagemaker.aws
studio.ap-south-1.sagemaker.aws
studio.ap-southeast-1.sagemaker.aws
studio.ap-southeast-2.sagemaker.aws
studio.ap-southeast-3.sagemaker.aws
studio.ca-central-1.sagemaker.aws
studio.eu-central-1.sagemaker.aws
studio.eu-central-2.sagemaker.aws
studio.eu-north-1.sagemaker.aws
studio.eu-south-1.sagemaker.aws
studio.eu-south-2.sagemaker.aws
studio.eu-west-1.sagemaker.aws
studio.eu-west-2.sagemaker.aws
studio.eu-west-3.sagemaker.aws
studio.il-central-1.sagemaker.aws
studio.me-central-1.sagemaker.aws
studio.me-south-1.sagemaker.aws
studio.sa-east-1.sagemaker.aws
studio.us-east-1.sagemaker.aws
studio.us-east-2.sagemaker.aws
studio.us-gov-east-1.sagemaker.aws
studio-fips.us-gov-east-1.sagemaker.aws
studio.us-gov-west-1.sagemaker.aws
studio-fips.us-gov-west-1.sagemaker.aws
studio.us-west-1.sagemaker.aws
studio.us-west-2.sagemaker.aws
studio.cn-north-1.sagemaker.com.cn
studio.cn-northwest-1.sagemaker.com.cn
*.experiments.sagemaker.aws
analytics-gateway.ap-northeast-1.amazonaws.com
analytics-gateway.ap-northeast-2.amazonaws.com
analytics-gateway.ap-south-1.amazonaws.com
analytics-gateway.ap-southeast-1.amazonaws.com
analytics-gateway.ap-southeast-2.amazonaws.com
analytics-gateway.eu-central-1.amazonaws.com
analytics-gateway.eu-west-1.amazonaws.com
analytics-gateway.us-east-1.amazonaws.com
analytics-gateway.us-east-2.amazonaws.com
analytics-gateway.us-west-2.amazonaws.com
amplifyapp.com
*.awsapprunner.com
webview-assets.aws-cloud9.af-south-1.amazonaws.com
vfs.cloud9.af-south-1.amazonaws.com
webview-assets.cloud9.af-south-1.amazonaws.com
webview-assets.aws-cloud9.ap-east-1.amazonaws.com
vfs.cloud9.ap-east-1.amazonaws.com
webview-assets.cloud9.ap-east-1.amazonaws.com
webview-assets.aws-cloud9.ap-northeast-1.amazonaws.com
vfs.cloud9.ap-northeast-1.amazonaws.com
webview-assets.cloud9.ap-northeast-1.amazonaws.com
webview-assets.aws-cloud9.ap-northeast-2.amazonaws.com
vfs.cloud9.ap-northeast-2.amazonaws.com
webview-assets.cloud9.ap-northeast-2.amazonaws.com
webview-assets.aws-cloud9.ap-northeast-3.amazonaws.com
vfs.cloud9.ap-northeast-3.amazonaws.com
webview-assets.cloud9.ap-northeast-3.amazonaws.com
webview-assets.aws-cloud9.ap-south-1.amazonaws.com
vfs.cloud9.ap-south-1.amazonaws.com
webview-assets.cloud9.ap-south-1.amazonaws.com
webview-assets.aws-cloud9.ap-southeast-1.amazonaws.com
vfs.cloud9.ap-southeast-1.amazonaws.com
webview-assets.cloud9.ap-southeast-1.amazonaws.com
webview-assets.aws-cloud9.ap-southeast-2.amazonaws.com
vfs.cloud9.ap-southeast-2.amazonaws.com
webview-assets.cloud9.ap-southeast-2.amazonaws.com
webview-assets.aws-cloud9.ca-central-1.amazonaws.com
vfs.cloud9.ca-central-1.amazonaws.com
webview-assets.cloud9.ca-central-1.amazonaws.com
webview-assets.aws-cloud9.eu-central-1.amazonaws.com
vfs.cloud9.eu-central-1.amazonaws.com
webview-assets.cloud9.eu-central-1.amazonaws.com
webview-assets.aws-cloud9.eu-north-1.amazonaws.com
vfs.cloud9.eu-north-1.amazonaws.com
webview-assets.cloud9.eu-north-1.amazonaws.com
webview-assets.aws-cloud9.eu-south-1.amazonaws.com
vfs.cloud9.eu-south-1.amazonaws.com
webview-assets.cloud9.eu-south-1.amazonaws.com
webview-assets.aws-cloud9.eu-west-1.amazonaws.com
vfs.cloud9.eu-west-1.amazonaws.com
webview-assets.cloud9.eu-west-1.amazonaws.com
webview-assets.aws-cloud9.eu-west-2.amazonaws.com
vfs.cloud9.eu-west-2.amazonaws.com
webview-assets.cloud9.eu-west-2.amazonaws.com
webview-assets.aws-cloud9.eu-west-3.amazonaws.com
vfs.cloud9.eu-west-3.amazonaws.com
webview-assets.cloud9.eu-west-3.amazonaws.com
webview-assets.aws-cloud9.il-central-1.amazonaws.com
vfs.cloud9.il-central-1.amazonaws.com
webview-assets.aws-cloud9.me-south-1.amazonaws.com
vfs.cloud9.me-south-1.amazonaws.com
webview-assets.cloud9.me-south-1.amazonaws.com
webview-assets.aws-cloud9.sa-east-1.amazonaws.com
vfs.cloud9.sa-east-1.amazonaws.com
webview-assets.cloud9.sa-east-1.amazonaws.com
webview-assets.aws-cloud9.us-east-1.amazonaws.com
vfs.cloud9.us-east-1.amazonaws.com
webview-assets.cloud9.us-east-1.amazonaws.com
webview-assets.aws-cloud9.us-east-2.amazonaws.com
vfs.cloud9.us-east-2.amazonaws.com
webview-assets.cloud9.us-east-2.amazonaws.com
webview-assets.aws-cloud9.us-west-1.amazonaws.com
vfs.cloud9.us-west-1.amazonaws.com
webview-assets.cloud9.us-west-1.amazonaws.com
webview-assets.aws-cloud9.us-west-2.amazonaws.com
vfs.cloud9.us-west-2.amazonaws.com
webview-assets.cloud9.us-west-2.amazonaws.com
awsapps.com
cn-north-1.eb.amazonaws.com.cn
cn-northwest-1.eb.amazonaws.com.cn
elasticbeanstalk.com
af-south-1.elasticbeanstalk.com
ap-east-1.elasticbeanstalk.com
ap-northeast-1.elasticbeanstalk.com
ap-northeast-2.elasticbeanstalk.com
ap-northeast-3.elasticbeanstalk.com
ap-south-1.elasticbeanstalk.com
ap-south-2.elasticbeanstalk.com
ap-southeast-1.elasticbeanstalk.com
ap-southeast-2.elasticbeanstalk.com
ap-southeast-3.elasticbeanstalk.com
ap-southeast-4.elasticbeanstalk.com
ap-southeast-5.elasticbeanstalk.com
ap-southeast-6.elasticbeanstalk.com
ap-southeast-7.elasticbeanstalk.com
ca-central-1.elasticbeanstalk.com
ca-west-1.elasticbeanstalk.com
eu-central-1.elasticbeanstalk.com
eu-central-2.elasticbeanstalk.com
eu-north-1.elasticbeanstalk.com
eu-south-1.elasticbeanstalk.com
eu-south-2.elasticbeanstalk.com
eu-west-1.elasticbeanstalk.com
eu-west-2.elasticbeanstalk.com
eu-west-3.elasticbeanstalk.com
il-central-1.elasticbeanstalk.com
me-central-1.elasticbeanstalk.com
me-south-1.elasticbeanstalk.com
sa-east-1.elasticbeanstalk.com
us-east-1.elasticbeanstalk.com
us-east-2.elasticbeanstalk.com
us-gov-east-1.elasticbeanstalk.com
us-gov-west-1.elasticbeanstalk.com
us-west-1.elasticbeanstalk.com
us-west-2.elasticbeanstalk.com
*.elb.amazonaws.com.cn
*.elb.amazonaws.com
awsglobalaccelerator.com
lambda-url.af-south-1.on.aws
lambda-url.ap-east-1.on.aws
lambda-url.ap-northeast-1.on.aws
lambda-url.ap-northeast-2.on.aws
lambda-url.ap-northeast-3.on.aws
lambda-url.ap-south-1.on.aws
lambda-url.ap-southeast-1.on.aws
lambda-url.ap-southeast-2.on.aws
lambda-url.ap-southeast-3.on.aws
lambda-url.ca-central-1.on.aws
lambda-url.eu-central-1.on.aws
lambda-url.eu-north-1.on.aws
lambda-url.eu-south-1.on.aws
lambda-url.eu-west-1.on.aws
lambda-url.eu-west-2.on.aws
lambda-url.eu-west-3.on.aws
lambda-url.me-south-1.on.aws
lambda-url.sa-east-1.on.aws
lambda-url.us-east-1.on.aws
lambda-url.us-east-2.on.aws
lambda-url.us-west-1.on.aws
lambda-url.us-west-2.on.aws
*.private.repost.aws
transfer-webapp.af-south-1.on.aws
transfer-webapp.ap-east-1.on.aws
transfer-webapp.ap-east-2.on.aws
transfer-webapp.ap-northeast-1.on.aws
transfer-webapp.ap-northeast-2.on.aws
transfer-webapp.ap-northeast-3.on.aws
transfer-webapp.ap-south-1.on.aws
transfer-webapp.ap-south-2.on.aws
transfer-webapp.ap-southeast-1.on.aws
transfer-webapp.ap-southeast-2.on.aws
transfer-webapp.ap-southeast-3.on.aws
transfer-webapp.ap-southeast-4.on.aws
transfer-webapp.ap-southeast-5.on.aws
transfer-webapp.ap-southeast-6.on.aws
transfer-webapp.ap-southeast-7.on.aws
transfer-webapp.ca-central-1.on.aws
transfer-webapp.ca-west-1.on.aws
transfer-webapp.eu-central-1.on.aws
transfer-webapp.eu-central-2.on.aws
transfer-webapp.eu-north-1.on.aws
transfer-webapp.eu-south-1.on.aws
transfer-webapp.eu-south-2.on.aws
transfer-webapp.eu-west-1.on.aws
transfer-webapp.eu-west-2.on.aws
transfer-webapp.eu-west-3.on.aws
transfer-webapp.il-central-1.on.aws
transfer-webapp.me-central-1.on.aws
transfer-webapp.me-south-1.on.aws
transfer-webapp.mx-central-1.on.aws
transfer-webapp.sa-east-1.on.aws
transfer-webapp.us-east-1.on.aws
transfer-webapp.us-east-2.on.aws
transfer-webapp.us-gov-east-1.on.aws
transfer-webapp-fips.us-gov-east-1.on.aws
transfer-webapp.us-gov-west-1.on.aws
transfer-webapp-fips.us-gov-west-1.on.aws
transfer-webapp.us-west-1.on.aws
transfer-webapp.us-west-2.on.aws
transfer-webapp.cn-north-1.on.amazonwebservices.com.cn
transfer-webapp.cn-northwest-1.on.amazonwebservices.com.cn
transfer-webapp.eusc-de-east-1.on.amazonwebservices.eu
eero.online
eero-stage.online
opentunnel.xyz
antagonist.cloud
claude.app
claudeusercontent.com
frame.claudeusercontent.com
apigee.io
panel.dev
siiites.com
int.apple
*.cloud.int.apple
*.r.cloud.int.apple
*.ap-north-1.r.cloud.int.apple
*.ap-south-1.r.cloud.int.apple
*.ap-south-2.r.cloud.int.apple
*.eu-central-1.r.cloud.int.apple
*.eu-north-1.r.cloud.int.apple
*.us-central-1.r.cloud.int.apple
*.us-central-2.r.cloud.int.apple
*.us-east-1.r.cloud.int.apple
*.us-east-2.r.cloud.int.apple
*.us-west-1.r.cloud.int.apple
*.us-west-2.r.cloud.int.apple
*.us-west-3.r.cloud.int.apple
appspacehosted.com
appspaceusercontent.com
appudo.net
appwrite.global
appwrite.network
*.appwrite.run
on-aptible.com
f5.si
arvanedge.ir
user.aseinet.ne.jp
gv.vc
d.gv.vc
user.party.eus
pimienta.org
poivron.org
potager.org
sweetpepper.org
myasustor.com
*.atlassian-3p.com
*.atlassian-3p-us-gov-mod.com
*.atlassian-isolated-3p.com
cdn.prod.atlassian-dev.net
myfritz.link
myfritz.net
*.awdev.ca
*.advisor.ws
ecommerce-shop.pl
b-data.io
balena-devices.com
base.ec
official.ec
buyshop.jp
fashionstore.jp
handcrafted.jp
kawaiishop.jp
supersale.jp
theshop.jp
shopselect.net
base.shop
beagleboard.io
bearblog.dev
*.beget.app
*.begetcdn.cloud
pages.gay
bnr.la
bitbucket.io
ship.place
blackbaudcdn.net
of.je
prod.page
square.site
bluebite.io
boomla.net
boutir.com
boxfuse.io
square7.ch
bplaced.com
bplaced.de
square7.de
bplaced.net
square7.net
brave.app
*.s.brave.app
brave.dev
*.s.brave.dev
brave.io
*.s.brave.io
shop.brendly.ba
shop.brendly.hr
shop.brendly.rs
browsersafetymark.io
radio.am
radio.fm
cdn.bubble.io
bubbleapps.io
manus.space
*.bwcloud-os-instance.de
cafjs.com
canva-apps.cn
canva-code.cn
my.canvasite.cn
khsj.cn
canva-apps.com
canva-hosted-embed.com
canvacode.com
rice-labs.com
canva.link
canva.run
my.canva.site
drr.ac
uwu.ai
carrd.co
crd.co
ju.mp
api.gov.uk
cdn77-storage.com
rsc.contentproxy9.cz
r.cdn77.net
cdn77-ssl.net
c.cdn77.org
rsc.cdn77.org
ssl.origin.cdn77-secure.org
za.bz
br.com
cn.com
de.com
eu.com
jpn.com
mex.com
ru.com
sa.com
uk.com
us.com
za.com
com.de
gb.net
hu.net
jp.net
se.net
uk.net
ae.org
com.se
cx.ua
discourse.diy
discourse.group
discourse.team
clerk.app
clerkstage.app
*.lcl.dev
*.lclstage.dev
*.stg.dev
*.stgstage.dev
cleverapps.cc
*.services.clever-cloud.com
cleverapps.io
cleverapps.tech
clickrising.net
cloudns.asia
cloudns.be
cloud-ip.biz
cloudns.biz
cloud-ip.cc
cloudns.cc
cloudns.ch
cloudns.cl
cloudns.club
abrdns.com
dnsabr.com
ip-ddns.com
cloudns.cx
cloudns.eu
cloudns.in
cloudns.info
ddns-ip.net
dns-cloud.net
dns-dynamic.net
cloudns.nz
cloudns.org
ip-dynamic.org
cloudns.ph
cloudns.pro
cloudns.pw
cloudns.us
c66.me
cloud66.ws
jdevcloud.com
wpdevcloud.com
cloudaccess.host
freesite.host
cloudaccess.net
cloudbeesusercontent.io
*.cloudera.site
cloudflare.app
cf-ipfs.com
cloudflare-ipfs.com
trycloudflare.com
pages.dev
r2.dev
workers.dev
cloudflare.net
cdn.cloudflare.net
cdn.cloudflareanycast.net
cdn.cloudflarecn.net
cdn.cloudflareglobal.net
cust.cloudscale.ch
objects.lpg.cloudscale.ch
objects.rma.cloudscale.ch
lpg.objectstorage.ch
rma.objectstorage.ch
cloudzyro.app
wnext.app
cnpy.gdn
*.otap.co
co.ca
co.com
sch.ac
dev.cv
store.cv
codeberg.page
codepen.app
codepen.dev
csb.app
preview.csb.app
co.nl
co.no
*.devinapps.com
webhosting.be
site.webhosting.be
prvw.eu
hosting-cluster.nl
site.hosting-cluster.nl
ctfcloud.net
convex.app
convex.cloud
eu-west-1.convex.cloud
us-east-1.convex.cloud
convex.site
eu-west-1.convex.site
us-east-1.convex.site
ac.ru
edu.ru
gov.ru
int.ru
mil.ru
corespeed.app
dyn.cosidns.de
dnsupdater.de
dynamisches-dns.de
internet-dns.de
l-o-g-i-n.de
dynamic-dns.info
feste-ip.net
knx-server.net
static-access.net
craft.me
realm.cz
cfolks.pl
cyon.link
cyon.site
biz.dk
co.dk
firm.dk
reg.dk
store.dk
dyndns.dappnode.io
builtwithdark.com
darklang.io
aws.databricksapps.com
*.azure.databricksapps.com
gcp.databricksapps.com
aws-gov.databricksapps.us
demo.datadetect.com
instance.datadetect.com
edgestack.me
dattolocal.com
dattorelay.com
dattoweb.com
mydatto.com
dattolocal.net
mydatto.net
ddnss.de
dyn.ddnss.de
dyndns.ddnss.de
dyn-ip24.de
dyndns1.de
home-webserver.de
dyn.home-webserver.de
myhome-server.de
ddnss.org
debian.net
definima.io
definima.net
deno.dev
deno-staging.dev
deno.net
sandbox.deno.net
deployagent.com
piebox.site
deployagent.space
dedyn.io
deuxfleurs.eu
deuxfleurs.page
*.at.ply.gg
d6.ply.gg
joinmc.link
playit.plus
*.at.playit.plus
with.playit.plus
icp0.io
*.raw.icp0.io
icp1.io
*.raw.icp1.io
opencloud.me
*.icp.net
caffeine.site
caffeine.xyz
mybox.company
intouch.email
mybox.me
mybox.page
dfirma.pl
dkonto.pl
you2.pl
ondigitalocean.app
*.digitaloceanspaces.com
qzz.io
us.kg
xx.kg
dpdns.org
discordsays.com
discordsez.com
jozi.biz
ccwu.cc
cc.cd
us.ci
de5.net
dnshome.at
resolve.bar
ddns.berlin
dnshome.cloud
ddnssec.de
dnshome.de
dyndnssec.de
heimdns.de
srvdns.de
dnshome.eu
dnshome.it
dyn.now
heimdns.online
ddns.wtf
docsflowy.site
online.th
shop.th
co.scot
me.scot
org.scot
drayddns.com
shoparena.pl
dreamhosters.com
durumis.com
duckdns.org
dy.fi
tunk.org
dyndns.biz
for-better.biz
for-more.biz
for-some.biz
for-the.biz
selfip.biz
webhop.biz
ftpaccess.cc
game-server.cc
myphotos.cc
scrapping.cc
blogdns.com
cechire.com
dnsalias.com
dnsdojo.com
doesntexist.com
dontexist.com
doomdns.com
dyn-o-saur.com
dynalias.com
dyndns-at-home.com
dyndns-at-work.com
dyndns-blog.com
dyndns-free.com
dyndns-home.com
dyndns-ip.com
dyndns-mail.com
dyndns-office.com
dyndns-pics.com
dyndns-remote.com
dyndns-server.com
dyndns-web.com
dyndns-wiki.com
dyndns-work.com
est-a-la-maison.com
est-a-la-masion.com
est-le-patron.com
est-mon-blogueur.com
from-ak.com
from-al.com
from-ar.com
from-ca.com
from-ct.com
from-dc.com
from-de.com
from-fl.com
from-ga.com
from-hi.com
from-ia.com
from-id.com
from-il.com
from-in.com
from-ks.com
from-ky.com
from-ma.com
from-md.com
from-mi.com
from-mn.com
from-mo.com
from-ms.com
from-mt.com
from-nc.com
from-nd.com
from-ne.com
from-nh.com
from-nj.com
from-nm.com
from-nv.com
from-oh.com
from-ok.com
from-or.com
from-pa.com
from-pr.com
from-ri.com
from-sc.com
from-sd.com
from-tn.com
from-tx.com
from-ut.com
from-va.com
from-vt.com
from-wa.com
from-wi.com
from-wv.com
from-wy.com
getmyip.com
gotdns.com
hobby-site.com
homelinux.com
homeunix.com
iamallama.com
is-a-anarchist.com
is-a-blogger.com
is-a-bookkeeper.com
is-a-bulls-fan.com
is-a-caterer.com
is-a-chef.com
is-a-conservative.com
is-a-cpa.com
is-a-cubicle-slave.com
is-a-democrat.com
is-a-designer.com
is-a-doctor.com
is-a-financialadvisor.com
is-a-geek.com
is-a-green.com
is-a-guru.com
is-a-hard-worker.com
is-a-hunter.com
is-a-landscaper.com
is-a-lawyer.com
is-a-liberal.com
is-a-libertarian.com
is-a-llama.com
is-a-musician.com
is-a-nascarfan.com
is-a-nurse.com
is-a-painter.com
is-a-personaltrainer.com
is-a-photographer.com
is-a-player.com
is-a-republican.com
is-a-rockstar.com
is-a-socialist.com
is-a-student.com
is-a-teacher.com
is-a-techie.com
is-a-therapist.com
is-an-accountant.com
is-an-actor.com
is-an-actress.com
is-an-anarchist.com
is-an-artist.com
is-an-engineer.com
is-an-entertainer.com
is-certified.com
is-gone.com
is-into-anime.com
is-into-cars.com
is-into-cartoons.com
is-into-games.com
is-leet.com
is-not-certified.com
is-slick.com
is-uberleet.com
is-with-theband.com
isa-geek.com
isa-hockeynut.com
issmarterthanyou.com
likes-pie.com
likescandy.com
neat-url.com
saves-the-whales.com
selfip.com
sells-for-less.com
sells-for-u.com
servebbs.com
simple-url.com
space-to-rent.com
teaches-yoga.com
writesthisblog.com
ath.cx
fuettertdasnetz.de
isteingeek.de
istmein.de
lebtimnetz.de
leitungsen.de
traeumtgerade.de
barrel-of-knowledge.info
barrell-of-knowledge.info
dyndns.info
for-our.info
groks-the.info
groks-this.info
here-for-more.info
knowsitall.info
selfip.info
webhop.info
forgot.her.name
forgot.his.name
at-band-camp.net
blogdns.net
broke-it.net
buyshouses.net
dnsalias.net
dnsdojo.net
does-it.net
dontexist.net
dynalias.net
dynathome.net
endofinternet.net
from-az.net
from-co.net
from-la.net
from-ny.net
gets-it.net
ham-radio-op.net
homeftp.net
homeip.net
homelinux.net
homeunix.net
in-the-band.net
is-a-chef.net
is-a-geek.net
isa-geek.net
kicks-ass.net
office-on-the.net
podzone.net
scrapper-site.net
selfip.net
sells-it.net
servebbs.net
serveftp.net
thruhere.net
webhop.net
merseine.nu
mine.nu
shacknet.nu
blogdns.org
blogsite.org
boldlygoingnowhere.org
dnsalias.org
dnsdojo.org
doesntexist.org
dontexist.org
doomdns.org
dvrdns.org
dynalias.org
dyndns.org
go.dyndns.org
home.dyndns.org
endofinternet.org
endoftheinternet.org
from-me.org
game-host.org
gotdns.org
hobby-site.org
homedns.org
homeftp.org
homelinux.org
homeunix.org
is-a-bruinsfan.org
is-a-candidate.org
is-a-celticsfan.org
is-a-chef.org
is-a-geek.org
is-a-knight.org
is-a-linux-user.org
is-a-patsfan.org
is-a-soxfan.org
is-found.org
is-lost.org
is-saved.org
is-very-bad.org
is-very-evil.org
is-very-good.org
is-very-nice.org
is-very-sweet.org
isa-geek.org
kicks-ass.org
misconfused.org
podzone.org
readmyblog.org
selfip.org
sellsyourhome.org
servebbs.org
serveftp.org
servegame.org
stuff-4-sale.org
webhop.org
better-than.tv
dyndns.tv
on-the-web.tv
worse-than.tv
is-by.us
land-4-sale.us
stuff-4-sale.us
dyndns.ws
mypets.ws
1cooldns.com
bumbleshrimp.com
ddnsfree.com
ddnsgeek.com
ddnsguru.com
dynuddns.com
dynuhosting.com
giize.com
gleeze.com
kozow.com
loseyourip.com
ooguy.com
pivohosting.com
theworkpc.com
wiredbladehosting.com
casacam.net
dynu.net
dynuddns.net
mysynology.net
opik.net
spryt.net
accesscam.org
camdvr.org
freeddns.org
mywire.org
roxa.org
webredirect.org
myddns.rocks
dynv6.net
e4.cz
easypanel.app
easypanel.host
*.ewp.live
twmail.cc
twmail.net
twmail.org
mymailer.com.tw
url.tw
at.emf.camp
rt.ht
elementor.cloud
elementor.cool
emergent.cloud
preview.emergentagent.com
emergent.host
mytuleap.com
tuleap-partners.com
encr.app
frontend.encr.app
encoreapi.com
lp.dev
api.lp.dev
objects.lp.dev
eu.encoway.cloud
eu.org
al.eu.org
asso.eu.org
at.eu.org
au.eu.org
be.eu.org
bg.eu.org
ca.eu.org
cd.eu.org
ch.eu.org
cn.eu.org
cy.eu.org
cz.eu.org
de.eu.org
dk.eu.org
edu.eu.org
ee.eu.org
es.eu.org
fi.eu.org
fr.eu.org
gr.eu.org
hr.eu.org
hu.eu.org
ie.eu.org
il.eu.org
in.eu.org
int.eu.org
is.eu.org
it.eu.org
jp.eu.org
kr.eu.org
lt.eu.org
lu.eu.org
lv.eu.org
me.eu.org
mk.eu.org
mt.eu.org
my.eu.org
net.eu.org
ng.eu.org
nl.eu.org
no.eu.org
nz.eu.org
pl.eu.org
pt.eu.org
ro.eu.org
ru.eu.org
se.eu.org
si.eu.org
sk.eu.org
tr.eu.org
uk.eu.org
us.eu.org
eurodir.ru
eu-1.evennode.com
eu-2.evennode.com
eu-3.evennode.com
eu-4.evennode.com
us-1.evennode.com
us-2.evennode.com
us-3.evennode.com
us-4.evennode.com
relay.evervault.app
relay.evervault.dev
exe.xyz
expo.app
on.expo.app
staging.expo.app
on.staging.expo.app
fspages.org
ru.net
adygeya.ru
bashkiria.ru
bir.ru
cbg.ru
com.ru
dagestan.ru
grozny.ru
kalmykia.ru
kustanai.ru
marine.ru
mordovia.ru
msk.ru
mytis.ru
nalchik.ru
nov.ru
pyatigorsk.ru
spb.ru
vladikavkaz.ru
vladimir.ru
abkhazia.su
adygeya.su
aktyubinsk.su
arkhangelsk.su
armenia.su
ashgabad.su
azerbaijan.su
balashov.su
bashkiria.su
bryansk.su
bukhara.su
chimkent.su
dagestan.su
east-kazakhstan.su
exnet.su
georgia.su
grozny.su
ivanovo.su
jambyl.su
kalmykia.su
kaluga.su
karacol.su
karaganda.su
karelia.su
khakassia.su
krasnodar.su
kurgan.su
kustanai.su
lenug.su
mangyshlak.su
mordovia.su
msk.su
murmansk.su
nalchik.su
navoi.su
north-kazakhstan.su
nov.su
obninsk.su
penza.su
pokrovsk.su
sochi.su
spb.su
tashkent.su
termez.su
togliatti.su
troitsk.su
tselinograd.su
tula.su
tuva.su
vladikavkaz.su
vladimir.su
vologda.su
channelsdvr.net
u.channelsdvr.net
edgecompute.app
fastly-edge.com
fastly-terrarium.com
freetls.fastly.net
map.fastly.net
a.prod.fastly.net
global.prod.fastly.net
a.ssl.fastly.net
b.ssl.fastly.net
global.ssl.fastly.net
fastlylb.net
map.fastlylb.net
*.user.fm
fastvps-server.com
fastvps.host
myfast.host
fastvps.site
myfast.space
conn.uk
copro.uk
hosp.uk
fedorainfracloud.org
fedorapeople.org
cloud.fedoraproject.org
app.os.fedoraproject.org
app.os.stg.fedoraproject.org
mydobiss.com
fh-muenster.io
payload.dev
figma.site
figma-gov.site
preview.site
filegear.me
hosted-by-files.com
firebaseapp.com
fldrv.com
on-fleek.app
flutterflow.app
sprites.app
fly.dev
e2b.app
framer.ai
framer.app
framercanvas.com
framer.media
framer.photos
framer.website
framer.wiki
*.0e.vc
freebox-os.com
freeboxos.com
fbx-os.fr
fbxos.fr
freebox-os.fr
freeboxos.fr
freedesktop.org
freemyip.com
*.frusky.de
wien.funkfeuer.at
daemon.asia
dix.asia
mydns.bz
0am.jp
0g0.jp
0j0.jp
0t0.jp
mydns.jp
pgw.jp
wjg.jp
keyword-on.net
live-on.net
server-on.net
mydns.tw
mydns.vc
*.futurecms.at
*.ex.futurecms.at
*.in.futurecms.at
futurehosting.at
futuremailing.at
*.ex.ortsinfo.at
*.kunden.ortsinfo.at
*.statics.cloud
gadget.app
gadget.host
campaign.gov.uk
service.gov.uk
independent-commission.uk
independent-inquest.uk
independent-inquiry.uk
independent-panel.uk
independent-review.uk
public-inquiry.uk
royal-commission.uk
gehirn.ne.jp
usercontent.jp
gentapps.com
gentlentapis.com
cdn-edges.net
gsj.bz
gitbook.io
github.app
githubusercontent.com
githubpreview.dev
github.io
gitlab.io
gitpage.si
glideos.app
nog.community
co.ro
shop.ro
lolipop.io
angry.jp
babyblue.jp
babymilk.jp
backdrop.jp
bambina.jp
bitter.jp
blush.jp
boo.jp
boy.jp
boyfriend.jp
but.jp
candypop.jp
capoo.jp
catfood.jp
cheap.jp
chicappa.jp
chillout.jp
chips.jp
chowder.jp
chu.jp
ciao.jp
cocotte.jp
coolblog.jp
cranky.jp
cutegirl.jp
daa.jp
deca.jp
deci.jp
digick.jp
egoism.jp
fakefur.jp
fem.jp
flier.jp
floppy.jp
fool.jp
frenchkiss.jp
girlfriend.jp
girly.jp
gloomy.jp
gonna.jp
greater.jp
hacca.jp
heavy.jp
her.jp
hiho.jp
hippy.jp
holy.jp
hungry.jp
icurus.jp
itigo.jp
jellybean.jp
kikirara.jp
kill.jp
kilo.jp
kuron.jp
littlestar.jp
lolipopmc.jp
lolitapunk.jp
lomo.jp
lovepop.jp
lovesick.jp
main.jp
mods.jp
mond.jp
mongolian.jp
moo.jp
namaste.jp
nikita.jp
nobushi.jp
noor.jp
oops.jp
parallel.jp
parasite.jp
pecori.jp
peewee.jp
penne.jp
pepper.jp
perma.jp
pigboat.jp
pinoko.jp
punyu.jp
pupu.jp
pussycat.jp
pya.jp
raindrop.jp
readymade.jp
sadist.jp
schoolbus.jp
secret.jp
staba.jp
stripper.jp
sub.jp
sunnyday.jp
thick.jp
tonkotsu.jp
under.jp
upper.jp
velvet.jp
verse.jp
versus.jp
vivian.jp
watson.jp
weblike.jp
whitesnow.jp
zombie.jp
heteml.net
vibehost.space
graphic.design
goip.de
*.hosted.app
*.run.app
*.mtls.run.app
web.app
*.0emm.com
appspot.com
*.r.appspot.com
blogspot.com
codespot.com
googleapis.com
googlecode.com
pagespeedmobilizer.com
withgoogle.com
withyoutube.com
*.gateway.dev
cloud.goog
translate.goog
*.usercontent.goog
cloudfunctions.net
cloud.run
ai.studio
goupile.fr
pymnt.uk
gov.de
gov.nl
grafana-dev.net
grayjayleagues.com
grebedoc.dev
g\xFCnstigbestellen.de
g\xFCnstigliefern.de
gv.uy
hackclub.app
h\xE4kkinen.fi
hashbang.sh
hasura.app
hasura-app.io
hatenablog.com
hatenadiary.com
hateblo.jp
hatenablog.jp
hatenadiary.jp
hatenadiary.org
pages.it.hs-heilbronn.de
pages-research.it.hs-heilbronn.de
heiyu.space
helioho.st
heliohost.us
hepforge.org
onhercules.app
hercules-app.com
hercules-dev.com
here.now
herokuapp.com
*.compute.herokuapp.com
heyflow.page
heyflow.site
ravendb.cloud
ravendb.community
development.run
ravendb.run
hidns.co
hidns.vip
homesklep.pl
*.kin.one
*.id.pub
*.kin.pub
seprox.hooc.me
hoplix.shop
orx.biz
biz.ng
co.biz.ng
dl.biz.ng
go.biz.ng
lg.biz.ng
on.biz.ng
col.ng
firm.ng
gen.ng
ltd.ng
ngo.ng
plc.ng
hstgr.cloud
hostyhosting.io
hf.space
static.hf.space
hypernode.io
iobb.net
co.cz
*.moonscale.io
moonscale.net
gr.com
iki.fi
ibxos.it
iliadboxos.it
imagine.diy
imagine-proxy.work
smushcdn.com
wphostedmail.com
wpmucdn.com
tempurl.host
wpmudev.host
dyn-berlin.de
in-berlin.de
in-brb.de
in-butter.de
in-dsl.de
in-vpn.de
in-dsl.net
in-vpn.net
in-dsl.org
in-vpn.org
oninferno.net
info.cx
ac.leg.br
al.leg.br
am.leg.br
ap.leg.br
ba.leg.br
ce.leg.br
df.leg.br
es.leg.br
go.leg.br
ma.leg.br
mg.leg.br
ms.leg.br
mt.leg.br
pa.leg.br
pb.leg.br
pe.leg.br
pi.leg.br
pr.leg.br
rj.leg.br
rn.leg.br
ro.leg.br
rr.leg.br
rs.leg.br
sc.leg.br
se.leg.br
sp.leg.br
to.leg.br
pixolino.com
na4u.ru
botdash.app
botdash.dev
botdash.gg
botdash.net
botda.sh
botdash.xyz
online-server.cloud
apps-1and1.com
live-website.com
webspace-host.com
apps-1and1.net
websitebuilder.online
app-ionos.space
iopsys.se
*.inbrowser.dev
*.dweb.link
*.inbrowser.link
ipifony.net
home64.de
ipv64.de
ipv64.net
iqhs.pl
ir.md
is-a-good.dev
iservschule.de
mein-iserv.de
schuldock.de
schulplattform.de
schulserver.de
test-iserv.de
iserv.dev
iserv.host
ispmanager.name
mel.cloudlets.com.au
cloud.interhostsolutions.be
alp1.ae.flow.ch
appengine.flow.ch
es-1.axarnet.cloud
diadem.cloud
vip.jelastic.cloud
jele.cloud
it1.eur.aruba.jenv-aruba.cloud
it1.jenv-aruba.cloud
keliweb.cloud
cs.keliweb.cloud
oxa.cloud
tn.oxa.cloud
uk.oxa.cloud
primetel.cloud
uk.primetel.cloud
ca.reclaim.cloud
uk.reclaim.cloud
us.reclaim.cloud
ch.trendhosting.cloud
de.trendhosting.cloud
jele.club
dopaas.com
paas.hosted-by-previder.com
rag-cloud.hosteur.com
rag-cloud-ch.hosteur.com
jcloud.ik-server.com
jcloud-ver-jpc.ik-server.com
demo.jelastic.com
paas.massivegrid.com
jed.wafaicloud.com
ryd.wafaicloud.com
j.scaleforce.com.cy
jelastic.dogado.eu
fi.cloudplatform.fi
jele.host
mircloud.host
paas.beebyte.io
sekd1.beebyteapp.io
jele.io
jc.neen.it
jcloud.kz
cloudjiffy.net
fra1-de.cloudjiffy.net
west1-us.cloudjiffy.net
jls-sto1.elastx.net
jls-sto2.elastx.net
jls-sto3.elastx.net
fr-1.paas.massivegrid.net
lon-1.paas.massivegrid.net
lon-2.paas.massivegrid.net
ny-1.paas.massivegrid.net
ny-2.paas.massivegrid.net
sg-1.paas.massivegrid.net
jelastic.saveincloud.net
nordeste-idc.saveincloud.net
j.scaleforce.net
sdscloud.pl
unicloud.pl
mircloud.ru
enscaled.sg
jele.site
jelastic.team
orangecloud.tn
j.layershift.co.uk
phx.enscaled.us
mircloud.us
myjino.ru
*.hosting.myjino.ru
*.landing.myjino.ru
*.spectrum.myjino.ru
*.vps.myjino.ru
jote.cloud
jotelulu.cloud
eu1-plenit.com
la1-plenit.com
us1-plenit.com
webadorsite.com
jouwweb.site
js.org
elastic.k2.cloud
lb.ru-msk.k2.cloud
s3.ru-msk.k2.cloud
website.ru-msk.k2.cloud
lb.ru-spb.k2.cloud
s3.ru-spb.k2.cloud
website.ru-spb.k2.cloud
s3.k2.cloud
website.k2.cloud
kaas.gg
khplay.nl
kapsi.fi
kdns.fr
ezproxy.kuleuven.be
kuleuven.cloud
keenetic.io
keenetic.link
keenetic.name
keenetic.pro
ae.kg
keymachine.de
kiloapps.ai
kiloapps.io
kinghost.net
uni5.net
koobin.events
webthings.io
krellian.net
co.de
shiptoday.app
shiptoday.build
laravel.cloud
on-forge.com
on-vapor.com
*.eth.limo
*.eth.link
git-repos.de
lcube-server.de
svn-repos.de
leadpages.co
lpages.co
lpusercontent.com
leapcell.app
leapcell.dev
leapcell.online
liara.run
iran.liara.run
libp2p.direct
runcontainers.dev
co.business
co.education
co.events
co.financial
co.network
co.place
co.technology
linkyard-cloud.ch
linkyard.cloud
linkyhost.page
members.linode.com
*.nodebalancer.linode.com
*.linodeobjects.com
ip.linodeusercontent.com
we.bs
filegear-sg.me
ggff.net
*.user.localcert.dev
localtonet.com
*.localto.net
lodz.pl
pabianice.pl
plock.pl
sieradz.pl
skierniewice.pl
zgierz.pl
loginline.app
loginline.dev
loginline.io
loginline.services
loginline.site
lohmus.me
lovable.app
auth.lovable.app
lovableproject.com
lovable.run
lovable.sh
krasnik.pl
leczna.pl
lubartow.pl
lublin.pl
poniatowa.pl
swidnik.pl
glug.org.uk
lug.org.uk
lugs.org.uk
barsy.bg
barsy.club
barsycenter.com
barsyonline.com
barsy.de
barsy.dev
barsy.eu
barsy.gr
barsy.in
barsy.info
barsy.io
barsy.me
barsy.menu
barsyonline.menu
barsy.mobi
barsy.net
barsy.online
barsy.org
barsy.pro
barsy.pub
barsy.ro
barsy.rs
barsy.shop
barsyonline.shop
barsy.site
barsy.store
barsy.support
barsy.uk
barsy.co.uk
barsyonline.co.uk
*.lutrausercontent.com
luyani.app
luyani.net
*.magentosite.cloud
magicpatterns.app
magicpatternsapp.com
hb.cldmail.ru
matlab.cloud
modelscape.com
mwcloudnonprod.com
polyspace.com
mayfirst.info
mcdir.me
mcdir.ru
vps.mcdir.ru
mcpre.ru
mediatech.by
mediatech.dev
hra.health
medusajs.app
miniserver.com
memset.net
messerli.app
atmeta.com
apps.fbsbx.com
*.metaaiusercontent.com
*.cloud.metacentrum.cz
custom.metacentrum.cz
flt.cloud.muni.cz
usr.cloud.muni.cz
meteorapp.com
eu.meteorapp.com
co.pl
*.azurecontainer.io
azure-api.net
azure-mobile.net
azureedge.net
azurefd.net
azurestaticapps.net
1.azurestaticapps.net
2.azurestaticapps.net
3.azurestaticapps.net
4.azurestaticapps.net
5.azurestaticapps.net
6.azurestaticapps.net
7.azurestaticapps.net
centralus.azurestaticapps.net
eastasia.azurestaticapps.net
eastus2.azurestaticapps.net
westeurope.azurestaticapps.net
westus2.azurestaticapps.net
azurewebsites.net
australiacentral-01.azurewebsites.net
australiacentral2-01.azurewebsites.net
australiaeast-01.azurewebsites.net
australiasoutheast-01.azurewebsites.net
austriaeast-01.azurewebsites.net
belgiumcentral-01.azurewebsites.net
brazilsouth-01.azurewebsites.net
brazilsoutheast-01.azurewebsites.net
canadacentral-01.azurewebsites.net
canadaeast-01.azurewebsites.net
centralindia-01.azurewebsites.net
centralus-01.azurewebsites.net
centraluseuap-01.azurewebsites.net
chilecentral-01.azurewebsites.net
denmarkeast-01.azurewebsites.net
eastasia-01.azurewebsites.net
eastasiastage-01.azurewebsites.net
eastus-01.azurewebsites.net
eastus2-01.azurewebsites.net
eastus2euap-01.azurewebsites.net
eastus3-01.azurewebsites.net
francecentral-01.azurewebsites.net
francesouth-01.azurewebsites.net
germanynorth-01.azurewebsites.net
germanywestcentral-01.azurewebsites.net
indiasouthcentral-01.azurewebsites.net
indonesiacentral-01.azurewebsites.net
israelcentral-01.azurewebsites.net
israelnorthwest-01.azurewebsites.net
italynorth-01.azurewebsites.net
japaneast-01.azurewebsites.net
japanwest-01.azurewebsites.net
jioindiacentral-01.azurewebsites.net
jioindiawest-01.azurewebsites.net
koreacentral-01.azurewebsites.net
koreasouth-01.azurewebsites.net
malaysiawest-01.azurewebsites.net
mexicocentral-01.azurewebsites.net
newzealandnorth-01.azurewebsites.net
northcentralus-01.azurewebsites.net
northcentralusstage-01.azurewebsites.net
northeastus5-01.azurewebsites.net
northeurope-01.azurewebsites.net
norwayeast-01.azurewebsites.net
norwaywest-01.azurewebsites.net
*.p.azurewebsites.net
polandcentral-01.azurewebsites.net
qatarcentral-01.azurewebsites.net
southafricanorth-01.azurewebsites.net
southafricawest-01.azurewebsites.net
southcentralus-01.azurewebsites.net
southcentralus2-01.azurewebsites.net
southeastasia-01.azurewebsites.net
southeastus5-01.azurewebsites.net
southindia-01.azurewebsites.net
spaincentral-01.azurewebsites.net
swedencentral-01.azurewebsites.net
swedensouth-01.azurewebsites.net
switzerlandnorth-01.azurewebsites.net
switzerlandwest-01.azurewebsites.net
taiwannorth-01.azurewebsites.net
taiwannorthwest-01.azurewebsites.net
uaecentral-01.azurewebsites.net
uaenorth-01.azurewebsites.net
uksouth-01.azurewebsites.net
ukwest-01.azurewebsites.net
westcentralus-01.azurewebsites.net
westeurope-01.azurewebsites.net
westindia-01.azurewebsites.net
westus-01.azurewebsites.net
westus2-01.azurewebsites.net
westus3-01.azurewebsites.net
cloudapp.net
trafficmanager.net
blob.core.usgovcloudapi.net
file.core.usgovcloudapi.net
web.core.usgovcloudapi.net
servicebus.usgovcloudapi.net
usgovcloudapp.net
usgovtrafficmanager.net
blob.core.windows.net
file.core.windows.net
web.core.windows.net
servicebus.windows.net
azure-api.us
azurewebsites.us
routingthecloud.com
sn.mynetname.net
routingthecloud.net
routingthecloud.org
same-app.com
same-preview.com
csx.cc
miren.app
miren.systems
mydbserver.com
webspaceconfig.de
mittwald.info
mittwaldserver.info
typo3server.info
project.space
mkm.fan
mocha.app
mochausercontent.com
mocha-sandbox.dev
modelence.app
cloud.modelence.app
sandbox.modelence.app
modx.dev
bmoattachments.org
net.ru
org.ru
pp.ru
my.be
hostedpi.com
caracal.mythic-beasts.com
customer.mythic-beasts.com
fentiger.mythic-beasts.com
lynx.mythic-beasts.com
ocelot.mythic-beasts.com
oncilla.mythic-beasts.com
onza.mythic-beasts.com
sphinx.mythic-beasts.com
vs.mythic-beasts.com
x.mythic-beasts.com
yali.mythic-beasts.com
cust.retrosnub.co.uk
ui.nabu.casa
kr.object.fin-ncloudstorage.com
s3-website.kr.object.fin-ncloudstorage.com
kr.object.private.fin-ncloudstorage.com
kr.gov-ncloudstorage.com
kr-private.gov-ncloudstorage.com
kr.object.gov-ncloudstorage.com
s3-website.kr.object.gov-ncloudstorage.com
krs.object.gov-ncloudstorage.com
s3-website.krs.object.gov-ncloudstorage.com
kr.object.private.gov-ncloudstorage.com
krs.object.private.gov-ncloudstorage.com
kr.objectstorage.ncloud.com
sg.objectstorage.ncloud.com
kr.ncloudstorage.com
kr-naver.ncloudstorage.com
kr-naver-dev.ncloudstorage.com
kr-private.ncloudstorage.com
de.object.ncloudstorage.com
s3-website.de.object.ncloudstorage.com
kr.object.ncloudstorage.com
s3-website.kr.object.ncloudstorage.com
sg.object.ncloudstorage.com
s3-website.sg.object.ncloudstorage.com
us.object.ncloudstorage.com
s3-website.us.object.ncloudstorage.com
kr.object.private.ncloudstorage.com
sg.object.private.ncloudstorage.com
kr.website.ncloudstorage.com
kr-naver.website.ncloudstorage.com
kr-naver-dev.website.ncloudstorage.com
jp.object.ncpstorage.com
jp.jp4.object.ncpstorage.com
jp.jp5.object.ncpstorage.com
kr.object.ncpstorage.com
s3-website-jp.object.ncpstorage.com
jp.object.private.ncpstorage.com
jp.jp4.object.private.ncpstorage.com
jp.jp5.object.private.ncpstorage.com
kr.object.private.ncpstorage.com
needle.run
co.site
cloud.nospamproxy.com
o365.cloud.nospamproxy.com
netlib.re
netlify.app
4u.com
nfshost.com
ipfs.nftstorage.link
ngo.us
ngrok.app
ngrok-free.app
ngrok.dev
ngrok-free.dev
ngrok.io
ap.ngrok.io
au.ngrok.io
eu.ngrok.io
in.ngrok.io
jp.ngrok.io
sa.ngrok.io
us.ngrok.io
ngrok.pizza
ngrok.pro
torun.pl
nh-serv.co.uk
nimsite.uk
mmafan.biz
myftp.biz
no-ip.biz
no-ip.ca
fantasyleague.cc
gotdns.ch
3utilities.com
blogsyte.com
ciscofreak.com
damnserver.com
ddnsking.com
ditchyourip.com
dnsiskinky.com
dynns.com
geekgalaxy.com
health-carereform.com
homesecuritymac.com
homesecuritypc.com
myactivedirectory.com
mysecuritycamera.com
myvnc.com
net-freaks.com
onthewifi.com
point2this.com
quicksytes.com
securitytactics.com
servebeer.com
servecounterstrike.com
serveexchange.com
serveftp.com
servegame.com
servehalflife.com
servehttp.com
servehumour.com
serveirc.com
servemp3.com
servep2p.com
servepics.com
servequake.com
servesarcasm.com
stufftoread.com
unusualperson.com
workisboring.com
dvrcam.info
ilovecollege.info
no-ip.info
brasilia.me
ddns.me
dnsfor.me
hopto.me
loginto.me
noip.me
webhop.me
bounceme.net
ddns.net
eating-organic.net
mydissent.net
myeffect.net
mymediapc.net
mypsx.net
mysecuritycamera.net
nhlfan.net
no-ip.net
pgafan.net
privatizehealthinsurance.net
redirectme.net
serveblog.net
serveminecraft.net
sytes.net
cable-modem.org
collegefan.org
couchpotatofries.org
hopto.org
mlbfan.org
myftp.org
mysecuritycamera.org
nflfan.org
no-ip.org
read-books.org
ufcfan.org
zapto.org
no-ip.co.uk
golffan.us
noip.us
pointto.us
stage.nodeart.io
*.developer.app
noop.app
*.northflank.app
*.build.run
*.code.run
*.database.run
*.migration.run
aberdeen.wa.us
bainbridge-isl.wa.us
bellevue.wa.us
bremerton.wa.us
centralia.wa.us
chehalis.wa.us
forks.wa.us
gig-harbor.wa.us
hoquiam.wa.us
keyport.wa.us
kingston.wa.us
olympia.wa.us
port-angeles.wa.us
port-ludlow.wa.us
port-orchard.wa.us
port-townsend.wa.us
poulsbo.wa.us
redmond.wa.us
renton.wa.us
sea.wa.us
seattle.wa.us
sequim.wa.us
shelton.wa.us
silverdale.wa.us
yarrow-point.wa.us
noticeable.news
notion.site
dnsking.ch
mypi.co
myiphost.com
forumz.info
soundcast.me
tcp4.me
dnsup.net
hicam.net
now-dns.net
ownip.net
vpndns.net
dynserv.org
now-dns.org
x443.pw
ntdll.top
freeddns.us
nsupdate.info
nerdpol.ovh
prvcy.page
observablehq.cloud
static.observableusercontent.com
omg.lol
cloudycluster.net
omniwe.site
123webseite.at
123website.be
simplesite.com.br
123website.ch
simplesite.com
123webseite.de
123hjemmeside.dk
123miweb.es
123kotisivu.fi
123siteweb.fr
simplesite.gr
123homepage.it
123website.lu
123website.nl
123hjemmeside.no
service.one
website.one
simplesite.pl
123paginaweb.pt
123minsida.se
onid.ca
is-a-fullstack.dev
is-cool.dev
is-not-a.dev
localplayer.dev
is-local.org
opensocial.site
*.oaiusercontent.com
chatgpt.site
opencraft.hosting
16-b.it
32-b.it
64-b.it
orsites.com
operaunite.com
*.customer-oci.com
*.oci.customer-oci.com
*.ocp.customer-oci.com
*.ocs.customer-oci.com
*.oraclecloudapps.com
*.oraclegovcloudapps.com
*.oraclegovcloudapps.uk
tech.orange
can.re
authgear-staging.com
authgearapps.com
outsystemscloud.com
*.hosting.ovh.net
*.webpaas.ovh.net
ownprovider.com
own.pm
*.owo.codes
ox.rs
oy.lc
pagelemon.dev
pgfog.com
gotpantheon.com
pantheonsite.io
*.paywhirl.com
*.xmit.co
xmit.dev
madethis.site
srv.us
gh.srv.us
gl.srv.us
mypep.link
pplx.app
forgeblocks.com
id.forgerock.io
support.site
on-web.fr
*.upsun.app
upsunapp.com
ent.platform.sh
eu.platform.sh
us.platform.sh
*.platformsh.site
*.tst.site
playcode.site
pley.games
onporter.run
co.bn
postman-echo.com
pstmn.io
mock.pstmn.io
httpbin.org
prequalifyme.today
xen.prgmr.com
priv.at
c01.kr
eliv-api.kr
eliv-cdn.kr
eliv-dns.kr
mmv.kr
vki.kr
dev.project-study.com
platter-app.dev
e.id
chirurgiens-dentistes-en-france.fr
byen.site
nyc.mn
*.cn.st
pubtls.org
puter.app
puter.site
puter.work
pythonanywhere.com
eu.pythonanywhere.com
qa2.com
qcx.io
*.sys.qcx.io
myqnapcloud.cn
mycloudnas.com
mynascloud.com
myqnapcloud.com
qoto.io
qualifioapp.com
ladesk.com
*.qualyhqpartner.com
*.qualyhqportal.com
qbuser.com
*.quipelements.com
vapor.cloud
vaporcloud.io
rackmaze.com
rackmaze.net
cloudsite.builders
myradweb.net
servername.us
web.in
in.net
myrdbx.io
site.rb-hosting.io
up.railway.app
*.on-rancher.cloud
*.on-k3s.io
*.on-rio.io
ravpage.co.il
readthedocs-hosted.com
readthedocs.io
rwx.run
rhcloud.com
instances.spawn.cc
*.clusters.rdpa.co
*.srvrless.rdpa.co
onrender.com
app.render.com
replit.app
id.replit.app
firewalledreplit.co
id.firewalledreplit.co
repl.co
id.repl.co
*.replit.dev
*.teams.replit.dev
repl.run
resindevice.io
devices.resinstaging.io
retool.app
adimo.co.uk
itcouldbewor.se
aus.basketball
nz.basketball
subsc-pay.com
subsc-pay.net
git-pages.rit.edu
rocketpreview.app
*.builtwithrocket.new
rocky.page
rub.de
ruhr-uni-bochum.de
io.noc.ruhr-uni-bochum.de
\u0431\u0438\u0437.\u0440\u0443\u0441
\u043A\u043E\u043C.\u0440\u0443\u0441
\u043A\u0440\u044B\u043C.\u0440\u0443\u0441
\u043C\u0438\u0440.\u0440\u0443\u0441
\u043C\u0441\u043A.\u0440\u0443\u0441
\u043E\u0440\u0433.\u0440\u0443\u0441
\u0441\u0430\u043C\u0430\u0440\u0430.\u0440\u0443\u0441
\u0441\u043E\u0447\u0438.\u0440\u0443\u0441
\u0441\u043F\u0431.\u0440\u0443\u0441
\u044F.\u0440\u0443\u0441
ras.ru
nyat.app
180r.com
dojin.com
sakuratan.com
sakuraweb.com
x0.com
2-d.jp
bona.jp
crap.jp
daynight.jp
eek.jp
flop.jp
halfmoon.jp
jeez.jp
matrix.jp
mimoza.jp
ivory.ne.jp
mail-box.ne.jp
mints.ne.jp
mokuren.ne.jp
opal.ne.jp
sakura.ne.jp
sumomo.ne.jp
topaz.ne.jp
netgamers.jp
nyanta.jp
o0o0.jp
rdy.jp
rgr.jp
rulez.jp
s3.isk01.sakurastorage.jp
s3.isk02.sakurastorage.jp
saloon.jp
sblo.jp
skr.jp
tank.jp
uh-oh.jp
undo.jp
rs.webaccel.jp
user.webaccel.jp
websozai.jp
xii.jp
squares.net
jpn.org
kirara.st
x0.to
from.tv
sakura.tv
*.builder.code.com
*.dev-builder.code.com
*.stg-builder.code.com
*.001.test.code-builder-stg.platform.salesforce.com
*.aa.crm.dev
*.ab.crm.dev
*.ac.crm.dev
*.ad.crm.dev
*.ae.crm.dev
*.af.crm.dev
*.ci.crm.dev
*.d.crm.dev
*.pa.crm.dev
*.pb.crm.dev
*.pc.crm.dev
*.pd.crm.dev
*.pe.crm.dev
*.pf.crm.dev
*.w.crm.dev
*.wa.crm.dev
*.wb.crm.dev
*.wc.crm.dev
*.wd.crm.dev
*.we.crm.dev
*.wf.crm.dev
sandcats.io
sanity.run
sanity.studio
sav.case
logoip.com
logoip.de
fr-par-1.baremetal.scw.cloud
fr-par-2.baremetal.scw.cloud
nl-ams-1.baremetal.scw.cloud
cockpit.fr-par.scw.cloud
ddl.fr-par.scw.cloud
dtwh.fr-par.scw.cloud
fnc.fr-par.scw.cloud
functions.fnc.fr-par.scw.cloud
ifr.fr-par.scw.cloud
k8s.fr-par.scw.cloud
nodes.k8s.fr-par.scw.cloud
kafk.fr-par.scw.cloud
mgdb.fr-par.scw.cloud
rdb.fr-par.scw.cloud
s3.fr-par.scw.cloud
s3-website.fr-par.scw.cloud
scbl.fr-par.scw.cloud
whm.fr-par.scw.cloud
priv.instances.scw.cloud
pub.instances.scw.cloud
k8s.scw.cloud
cockpit.nl-ams.scw.cloud
ddl.nl-ams.scw.cloud
dtwh.nl-ams.scw.cloud
ifr.nl-ams.scw.cloud
k8s.nl-ams.scw.cloud
nodes.k8s.nl-ams.scw.cloud
kafk.nl-ams.scw.cloud
mgdb.nl-ams.scw.cloud
rdb.nl-ams.scw.cloud
s3.nl-ams.scw.cloud
s3-website.nl-ams.scw.cloud
scbl.nl-ams.scw.cloud
whm.nl-ams.scw.cloud
cockpit.pl-waw.scw.cloud
ddl.pl-waw.scw.cloud
dtwh.pl-waw.scw.cloud
ifr.pl-waw.scw.cloud
k8s.pl-waw.scw.cloud
nodes.k8s.pl-waw.scw.cloud
kafk.pl-waw.scw.cloud
mgdb.pl-waw.scw.cloud
rdb.pl-waw.scw.cloud
s3.pl-waw.scw.cloud
s3-website.pl-waw.scw.cloud
scbl.pl-waw.scw.cloud
scalebook.scw.cloud
smartlabeling.scw.cloud
dedibox.fr
scw.site
ams.scw.site
waw.scw.site
schokokeks.net
gov.scot
service.gov.scot
mygov.scot
scrysec.com
client.scrypted.io
firewall-gateway.com
firewall-gateway.de
my-gateway.de
my-router.de
spdns.de
spdns.eu
firewall-gateway.net
my-firewall.org
myfirewall.org
spdns.org
seidat.net
sellfy.store
minisite.ms
senseering.net
servebolt.cloud
biz.ua
co.ua
pp.ua
as.sh.cn
vicp.fun
yicp.fun
zicp.fun
sheezy.games
myshopblocks.com
myshopify.com
shopitsite.com
shopware.shop
shopware.store
mo-siemens.io
1kapp.com
appchizi.com
applinzi.com
sinaapp.com
vipsinaapp.com
siteleaf.net
sliplane.app
small-web.org
aeroport.fr
avocat.fr
chambagri.fr
chirurgiens-dentistes.fr
experts-comptables.fr
medecin.fr
notaires.fr
pharmacien.fr
port.fr
veterinaire.fr
vp4.me
*.snowflake.app
*.privatelink.snowflake.app
streamlit.app
streamlitapp.com
try-snowplow.com
mafelo.net
sol.site
playstation-cloud.com
srht.site
apps.lair.io
*.stolos.io
4.at
my.at
my.de
*.nxa.eu
nx.gw
*.apps.grok.bot
*.pages.grok.bot
*.cursorusercontent.com
grok.me
spawnbase.app
customer.speedpartner.de
myspreadshop.at
myspreadshop.com.au
myspreadshop.be
myspreadshop.ca
myspreadshop.ch
myspreadshop.com
myspreadshop.de
myspreadshop.dk
myspreadshop.es
myspreadshop.fi
myspreadshop.fr
myspreadshop.ie
myspreadshop.it
myspreadshop.net
myspreadshop.nl
myspreadshop.no
myspreadshop.pl
myspreadshop.se
myspreadshop.co.uk
w-corp-staticblitz.com
w-credentialless-staticblitz.com
w-staticblitz.com
bolt.host
stackhero-network.com
runs.onstackit.cloud
stackit.gg
stackit.rocks
stackit.run
stackit.zone
sryze.cc
indevs.in
musician.io
novecore.site
statichost.page
feedback.ac
forms.ac
assessments.cx
calculators.cx
funnels.cx
paynow.cx
quizzes.cx
researched.cx
tests.cx
surveys.so
ipfs.storacha.link
ipfs.w3s.link
storebase.store
strapiapp.com
media.strapiapp.com
vps-host.net
atl.jelastic.vps-host.net
njs.jelastic.vps-host.net
ric.jelastic.vps-host.net
streak-link.com
streaklinks.com
streakusercontent.com
soc.srcf.net
user.srcf.net
utwente.io
temp-dns.com
supabase.co
realtime.supabase.co
storage.supabase.co
supabase.in
supabase.net
surge.sh
syncloud.it
dscloud.biz
direct.quickconnect.cn
dsmynas.com
familyds.com
diskstation.me
dscloud.me
i234.me
myds.me
synology.me
dscloud.mobi
dsmynas.net
familyds.net
dsmynas.org
familyds.org
direct.quickconnect.to
vpnplus.to
mytabit.com
mytabit.co.il
tabitorder.co.il
taifun-dns.de
erp.dev
web.erp.dev
ts.net
*.c.ts.net
gda.pl
gdansk.pl
gdynia.pl
med.pl
sopot.pl
taveusercontent.com
p.tawk.email
p.tawkto.email
tche.br
site.tb-hosting.com
directwp.eu
ec.cc
eu.cc
gu.cc
uk.cc
us.cc
edugit.io
s3.teckids.org
telebit.app
telebit.io
*.telebit.xyz
teleport.sh
*.firenet.ch
*.svc.firenet.ch
reservd.com
thingdustdata.com
cust.dev.thingdust.io
reservd.dev.thingdust.io
cust.disrec.thingdust.io
reservd.disrec.thingdust.io
cust.prod.thingdust.io
cust.testing.thingdust.io
reservd.testing.thingdust.io
tickets.io
t3.storage.dev
t3.storageapi.dev
arvo.network
azimuth.network
tlon.network
torproject.net
pages.torproject.net
townnews-staging.com
12hp.at
2ix.at
4lima.at
lima-city.at
12hp.ch
2ix.ch
4lima.ch
lima-city.ch
trafficplex.cloud
de.cool
12hp.de
2ix.de
4lima.de
lima-city.de
1337.pictures
clan.rip
lima-city.rocks
webspace.rocks
lima.zone
*.transurl.be
*.transurl.eu
site.transip.me
*.transurl.nl
*.triton.zone
tunnelmole.net
tuxfamily.org
typedream.app
pro.typeform.com
uber.space
hk.com
inc.hk
ltd.hk
hk.org
it.com
umso.co
unison-services.cloud
virtual-user.de
virtualuser.de
obj.ag
name.pm
sch.tf
biz.wf
sch.wf
org.yt
rs.ba
bielsko.pl
urown.cloud
dnsupdate.info
us.org
v.ua
val.run
web.val.run
vercel.app
v0.build
vercel.dev
vusercontent.net
tmp.now
vercel.run
now.sh
2038.io
vibekit.page
v-info.info
vistablog.ir
deus-canvas.com
vivenushop.com
vivenushop.dev
voorloper.cloud
*.vultrobjects.com
wafflecell.com
wal.app
wasmer.app
webflow.io
webflowtest.io
*.webhare.dev
hotelwithflight.com
reserve-online.net
book.online
cprapid.com
pleskns.com
wp2.host
pdns.page
plesk.page
cpanel.site
wpsquared.site
*.wadl.top
remotewd.com
box.ca
pages.wiardweb.com
toolforge.org
wmcloud.org
beta.wmcloud.org
wmflabs.org
hrsn.dev
is-a.dev
vps.hrsn.net
localcert.net
windsurf.app
windsurf.build
drive-platform.com
drive-platform.io
panel.gg
daemon.panel.gg
base44.app
base44-sandbox.com
wixsite.com
wixstudio.com
editorx.io
wixstudio.io
wix.run
messwithdns.com
woltlab-demo.com
myforum.community
community-pro.de
diskussionsbereich.de
community-pro.net
meinforum.net
affinitylottery.org.uk
raffleentry.org.uk
weeklylottery.org.uk
wpenginepowered.com
js.wpenginepowered.com
*.xenonconnect.de
half.host
cistron.nl
demon.nl
xs4all.space
xtooldevice.com
yandexcloud.net
storage.yandexcloud.net
website.yandexcloud.net
sourcecraft.site
official.academy
yolasite.com
ynh.fr
nohost.me
noho.st
za.net
za.org
zap.cloud
zeabur.app
*.zerops.app
prg1-zerops.zone
*.zerops.zone
bss.design
basicserver.io
virtualserver.io
enterprisecloud.nu
zone.id
nett.to
zabc.net`;
var PUBLIC_SUFFIX_RULES = RULES.split("\n");

// src/internal/conformance/url-hosts.ts
var SHARED_HOSTS = /* @__PURE__ */ new Set([
  "cloudfront.net",
  "amazonaws.com",
  "storage.googleapis.com",
  "blob.core.windows.net",
  "web.core.windows.net",
  "herokuapp.com",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "workers.dev",
  "github.io",
  "githubusercontent.com",
  "gitlab.io",
  "bitbucket.io",
  "appspot.com",
  "firebaseapp.com",
  "web.app",
  "azurewebsites.net",
  "elasticbeanstalk.com",
  "onrender.com",
  "railway.app",
  "fly.dev",
  "deno.dev",
  "glitch.me",
  "repl.co",
  "surge.sh",
  "ngrok.io",
  "r2.dev",
  "blogspot.com",
  "blogspot.co.uk",
  "blogspot.de",
  "blogspot.in",
  "wordpress.com",
  "wixsite.com",
  "translate.goog",
  "ipfs.io",
  "dweb.link",
  "bit.ly",
  "tinyurl.com"
]);
var TRACKER_HOSTS = /* @__PURE__ */ new Set([
  "doubleclick.net",
  "google-analytics.com",
  "googletagmanager.com",
  "googleadservices.com",
  "googlesyndication.com",
  "2mdn.net",
  "facebook.net",
  "scorecardresearch.com",
  "criteo.com",
  "taboola.com",
  "outbrain.com",
  "adnxs.com",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "quantserve.com",
  "moatads.com",
  "adsrvr.org",
  "casalemedia.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "clarity.ms",
  "branch.io",
  "appsflyer.com",
  "adjust.com",
  "kochava.com",
  "smartadserver.com",
  "teads.tv",
  "yieldmo.com",
  "bat.bing.com"
]);
var PSL = new Set(PUBLIC_SUFFIX_RULES);
function publicSuffixOf(host) {
  const labels = host.toLowerCase().split(".");
  for (let index = 0; index < labels.length; index++) {
    const candidate = labels.slice(index).join(".");
    if (PSL.has(`!${candidate}`)) {
      const exception = labels.slice(index + 1).join(".");
      return exception === "" ? null : exception;
    }
  }
  for (let index = 0; index < labels.length; index++) {
    const candidate = labels.slice(index).join(".");
    if (PSL.has(candidate)) return candidate;
    const parent = labels.slice(index + 1).join(".");
    if (parent !== "" && PSL.has(`*.${parent}`)) return candidate;
  }
  return null;
}
function urlHostProblem(host) {
  if (typeof host !== "string" || !/^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    return "is not a host pattern (a domain such as slack.com, or *.slack.com)";
  }
  const bare = host.toLowerCase().replace(/^\*\./, "");
  if (bare.split(".").some((label) => label.startsWith("xn--"))) return "is a punycode host (a label starting xn--), which hides what it is";
  const suffix = publicSuffixOf(bare);
  if (suffix === null) return "names no public suffix (its top-level domain is not in the Public Suffix List)";
  if (suffix === bare) return `is a public suffix (${bare}), which names no site`;
  for (const listed of SHARED_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a shared host (${listed}), which anyone can claim`;
  for (const listed of TRACKER_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a tracker (${listed}), which is no source's destination`;
  return null;
}
function thumbnailHostProblem(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return "is not a URL";
  }
  return urlHostProblem(host);
}

// src/internal/conformance/declaration.ts
var PREFIXES = [
  { pattern: /^(?:delete|remove|purge|trash)_/, class: "delete", because: "a method that deletes something is class delete" },
  { pattern: /^(?:send|post|reply|forward|publish)_/, class: "send", because: "a method that sends something is class send" },
  { pattern: /^share_/, class: "share", because: "a method that widens access is class share" },
  { pattern: /^(?:export|download)_/, class: "export", because: "a method whose output leaves the provider is class export" },
  { pattern: /^(?:create|update|write|set|edit|put|patch|insert|add|modify|move|rename|upload|save)_/, class: "write", because: "a method that changes something is class write" },
  { pattern: /^admin_/, class: "admin", because: "a method that administers the provider is class admin" }
];
var RISK = { read: 0, write: 1, export: 2, send: 3, share: 4, delete: 5, admin: 6 };
function sameRule(row, wildcard) {
  const operations = new Set(wildcard.operations ?? []);
  const same = (row.operations ?? []).length === operations.size && (row.operations ?? []).every((operation) => operations.has(operation));
  return row.class === wildcard.class && row.effect === wildcard.effect && same;
}
function methodName(method) {
  return method.startsWith("mcp:") ? method.slice("mcp:".length) : method;
}
function declarationFindings(installed) {
  const findings = [];
  const { manifest } = installed;
  const name = manifest.plugin.name;
  const expectedPackage = `@we-the-rebel-alliance/${name}-plugin`;
  if (installed.package !== expectedPackage) {
    findings.push(
      error("names.package", `the package is ${installed.package}, and contract \xA73 derives ${expectedPackage} from the plugin name ${name}`, {
        path: "package.json",
        fix: `Rename the package to ${expectedPackage}, or change capabilities.plugin.name to the name the package already uses.`
      })
    );
  }
  for (const [method, item] of Object.entries(manifest.methods)) {
    const named = methodName(method);
    if (named === "*") continue;
    for (const prefix of PREFIXES) {
      if (!prefix.pattern.test(named) || item.class === prefix.class) continue;
      if (RISK[item.class] > RISK[prefix.class]) continue;
      findings.push(
        error("methods.class", `${method} is class ${item.class}, and its name says ${prefix.class}: ${prefix.because}`, {
          path: `capabilities.methods.${method}.class`,
          fix: `Set its class to ${prefix.class}, or rename it so the name and the class agree.`
        })
      );
      break;
    }
    if (METHOD_CLASSES.includes(item.class) === false) {
      findings.push(error("methods.class", `${method} names no class the contract defines`, { path: `capabilities.methods.${method}.class` }));
    }
    if (item.plans === true && item.class !== "read") {
      findings.push(
        error("methods.plans", `${method} plans a change and is class ${item.class}: a plan writes nothing, so its method is a read`, {
          path: `capabilities.methods.${method}.class`,
          fix: "Make the planning method class read, and leave the change to the method its commits names."
        })
      );
    }
    if (item.commits !== void 0 && manifest.methods[item.commits]?.class !== "read") {
      findings.push(
        error("methods.commits", `${method} commits ${item.commits}, which is class ${manifest.methods[item.commits]?.class}: a plan dry-runs the change and is a read`, {
          path: `capabilities.methods.${method}.commits`,
          fix: `Class ${item.commits} read, or name another planning method.`
        })
      );
    }
    const wildcard = manifest.methods["mcp:*"];
    if (method.startsWith("mcp:") && method !== "mcp:*" && wildcard !== void 0 && sameRule(item, wildcard)) {
      findings.push(
        warning("methods.mcp-wildcard", `${method} is listed beside mcp:*, and classifies the tool as the wildcard does`, {
          path: `capabilities.methods.${method}`,
          fix: "Remove the row, or give the tool its own class, effect or operations where it differs from mcp:*."
        })
      );
    }
  }
  for (const source of manifest.sources) {
    const method = manifest.methods[source.method];
    if (method === void 0) continue;
    if (method.class !== "read") {
      findings.push(
        error("sources.method", `${source.id} is read by ${source.method}, which is class ${method.class}: a source is a read`, {
          path: `capabilities.sources.${source.id}.method`,
          fix: `Read ${source.id} through a read method.`
        })
      );
    }
    if (source.operations !== void 0 && method.operations !== void 0) {
      for (const operation of source.operations) {
        if (method.operations.includes(operation)) continue;
        findings.push(
          error("sources.operations", `${source.id} asserts ${operation}, and ${source.method} does not list it among its operations`, {
            path: `capabilities.sources.${source.id}.operations`,
            fix: `Add ${operation} to capabilities.methods.${source.method}.operations, or remove it from the source.`
          })
        );
      }
    }
    if (source.details !== void 0) {
      for (const detail of source.details) {
        if (!detail.id.startsWith(`${source.id}.`)) {
          findings.push(
            error("sources.details", `${detail.id} is a detail of ${source.id} and does not begin with ${source.id}.`, {
              path: `capabilities.sources.${source.id}.details`,
              fix: `Rename the detail to ${source.id}.<name>.`
            })
          );
        }
        const read = manifest.methods[detail.method];
        if (read !== void 0 && read.class !== "read") {
          findings.push(
            error("sources.details", `${detail.id} is read by ${detail.method}, which is class ${read.class}: a detail read is a read`, {
              path: `capabilities.sources.${source.id}.details`
            })
          );
        }
      }
    }
    const suggested = source.scope?.suggest;
    if (suggested !== void 0) {
      const read = manifest.methods[suggested.method];
      if (read !== void 0 && read.class !== "read") {
        findings.push(
          error("sources.suggest", `${source.id}'s scope is listed by ${suggested.method}, which is class ${read.class}: a bind-time read is a read`, {
            path: `capabilities.sources.${source.id}.scope.suggest.method`
          })
        );
      }
      for (const operation of suggested.operations ?? []) {
        if ((source.operations ?? []).includes(operation)) {
          findings.push(
            error("sources.suggest", `${source.id}'s suggest lists ${operation}, which the source's own operations also list: a bind-time read stays out of the running grant`, {
              path: `capabilities.sources.${source.id}.scope.suggest.operations`
            })
          );
        }
      }
    }
    if (source.kind === "events" && source.thumbnails === true && source.urlHosts === void 0) {
      findings.push(error("sources.thumbnails", `${source.id} declares thumbnails and no urlHosts: a thumbnail is displayed only on a host the source names`, { path: `capabilities.sources.${source.id}.thumbnails` }));
    }
    for (const host of source.urlHosts ?? []) {
      const problem = urlHostProblem(host);
      if (problem !== null) findings.push(error("sources.urlHosts", `${source.id}'s urlHost ${JSON.stringify(host)} ${problem}`, { path: `capabilities.sources.${source.id}.urlHosts` }));
    }
  }
  for (const action of manifest.actions) previewFindings(manifest, action, findings);
  return findings;
}
function previewFindings(manifest, action, findings) {
  const preview = manifest.methods[action.preview];
  const commit = manifest.methods[action.commit];
  if (preview !== void 0 && preview.class !== "read") {
    findings.push(
      error("actions.preview", `${action.id}'s preview is ${action.preview}, which is class ${preview.class}: a preview writes nothing`, {
        path: `capabilities.actions.${action.id}.preview`,
        fix: `Preview ${action.id} through a read method, and commit it through ${action.commit}.`
      })
    );
  }
  if (commit !== void 0 && commit.class === "read") {
    findings.push(
      error("actions.commit", `${action.id}'s commit is ${action.commit}, which is class read: committing an action changes something`, {
        path: `capabilities.actions.${action.id}.commit`,
        fix: `Class ${action.commit} by what it does.`
      })
    );
  }
  if (action.preview === action.commit) {
    findings.push(error("actions.commit", `${action.id} previews and commits through ${action.commit}: \xA78 asks for two different methods`, { path: `capabilities.actions.${action.id}` }));
  }
}
function optionsFindings(manifest) {
  const findings = [];
  const schema = manifest.options;
  const properties = schema["properties"] ?? {};
  const access = properties["access"];
  if (access === void 0) {
    findings.push(error("options.access", "the options schema does not declare access", { path: "capabilities.options.properties.access", fix: "Declare access as all, ask-changes or read-only, default all." }));
  } else {
    const values = access["enum"];
    if (Array.isArray(values) && (values.length !== 3 || !["all", "ask-changes", "read-only"].every((value) => values.includes(value)))) {
      findings.push(error("options.access", `access offers ${values.map(String).join(", ")}, and the contract's levels are all, ask-changes and read-only`, { path: "capabilities.options.properties.access.enum" }));
    }
    if (access["default"] !== void 0 && access["default"] !== "all") {
      findings.push(error("options.access-default", `access defaults to ${JSON.stringify(access["default"])}, and standard \xA75 gives all`, { path: "capabilities.options.properties.access.default", fix: "Default access to all." }));
    }
  }
  const untested = properties["allowUntestedHost"];
  if (untested !== void 0 && untested["default"] !== void 0 && untested["default"] !== false) {
    findings.push(error("options.untested-default", `allowUntestedHost defaults to ${JSON.stringify(untested["default"])}, and standard \xA75 gives false`, { path: "capabilities.options.properties.allowUntestedHost.default" }));
  }
  if (manifest.accounts !== void 0 && properties["accounts"] === void 0) {
    findings.push(error("options.accounts", `${manifest.plugin.name} signs in and its options declare no accounts map`, { path: "capabilities.options.properties.accounts", fix: "Declare accounts as a map of alias to profile." }));
  }
  findings.push(...defaultsFindings(schema, properties));
  return findings;
}
function defaultsFindings(schema, properties) {
  const defaults = {};
  for (const [name, value] of Object.entries(properties)) {
    if (value === null || typeof value !== "object") continue;
    const property = value;
    if (property["default"] !== void 0) defaults[name] = property["default"];
  }
  try {
    const parsed = fromJSONSchema(schema).safeParse(defaults);
    if (parsed.success) return [];
    return [
      error("options.defaults", `the options' defaults do not satisfy the options schema: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "the options"}: ${issue.message}`).join("; ")}`, {
        path: "capabilities.options",
        fix: "Give every option a default the schema accepts."
      })
    ];
  } catch (cause) {
    return [error("options.defaults", `the options schema cannot be read: ${cause instanceof Error ? cause.message : String(cause)}`, { path: "capabilities.options" })];
  }
}

// src/internal/conformance/fixture.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
function readFixture(directory) {
  let text;
  try {
    text = readFileSync(join(directory, "fixtures", "conformance.json"), "utf8");
  } catch {
    return {};
  }
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return { problem: "fixtures/conformance.json is not an object" };
    return { fixture: value };
  } catch (cause) {
    return { problem: `fixtures/conformance.json is not JSON: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}

// src/internal/conformance/grants.ts
var REQUIRED_GRANT_CODES = ["GRANT_AUDIENCE_MISMATCH", "GRANT_DIGEST_MISMATCH", "GRANT_EXPIRED", "GRANT_REPLAYED"];
function kidOf(token) {
  const [encoded] = token.split(".");
  if (encoded === void 0) return void 0;
  try {
    const header = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return typeof header.kid === "string" ? header.kid : void 0;
  } catch {
    return void 0;
  }
}
async function grantFindings(manifest, recorded, options = {}) {
  const findings = [];
  const nonLocal = manifest.actions.filter((action) => action.effect !== "local");
  if (nonLocal.length === 0) return findings;
  if (recorded === void 0 || (recorded.cases ?? []).length === 0) {
    findings.push(
      options.record === true ? warning("grants.recorded", `${manifest.plugin.name} has non-local actions and records no grant case yet`, { path: "fixtures/conformance.json" }) : error("grants.recorded", `${manifest.plugin.name} has non-local actions and records no grant case`, {
        path: "fixtures/conformance.json",
        fix: "Record a valid grant and the four refusals #40 names, then verify them with the grant module."
      })
    );
    return findings;
  }
  const publicKey = recorded.publicKey;
  if (typeof publicKey !== "string" || publicKey.trim() === "") {
    findings.push(error("grants.key", "the grant recording names no host public key", { path: "fixtures/conformance.json", fix: "Record the host's public key, never its private key." }));
    return findings;
  }
  const codes = /* @__PURE__ */ new Set();
  let succeeded = false;
  for (const [index, item] of (recorded.cases ?? []).entries()) {
    const where = `grant(${item.name ?? `case ${index + 1}`})`;
    if (typeof item.token !== "string") {
      findings.push(error("grants.case", `${where} has no token`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (item.request === void 0) {
      findings.push(error("grants.case", `${where} has no request: the action, consumer, account, scope and manifest it was signed for`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (item.expect === void 0 || typeof item.expect.ok !== "boolean") {
      findings.push(error("grants.case", `${where} says neither that the grant verifies nor that it is refused`, { path: "fixtures/conformance.json" }));
      continue;
    }
    const act = item.request["act"];
    if (typeof act === "string" && !manifest.actions.some((action) => action.id === act)) {
      findings.push(error("grants.action", `${where} is signed for ${act}, which capabilities.actions does not declare`, { path: "fixtures/conformance.json" }));
    }
    const kid = kidOf(item.token) ?? "host";
    const used = new Set(item.store?.used ?? []);
    const request = {
      ...item.request,
      grant: item.token,
      input: item.input,
      keys: { keys: { [kid]: publicKey } },
      store: {
        consume: async (claims) => {
          if (used.has(claims.jti)) return false;
          used.add(claims.jti);
          return true;
        }
      }
    };
    const outcome = await verifyGrant(request);
    if (item.expect.ok === true) {
      if (!outcome.ok) {
        findings.push(error("grants.verdict", `${where} does not verify: ${outcome.code} (${outcome.reason})`, { path: "fixtures/conformance.json" }));
        continue;
      }
      succeeded = true;
      continue;
    }
    const expected = typeof item.expect.code === "string" ? item.expect.code : void 0;
    if (outcome.ok) {
      findings.push(error("grants.verdict", `${where} verifies, and the recording says it is refused${expected === void 0 ? "" : ` (${expected})`}`, { path: "fixtures/conformance.json" }));
      continue;
    }
    codes.add(outcome.code);
    if (expected !== void 0 && outcome.code !== expected) findings.push(error("grants.verdict", `${where} is refused with ${outcome.code}, not the recorded ${expected}`, { path: "fixtures/conformance.json" }));
  }
  if (!succeeded) findings.push(error("grants.cases", "no recorded grant verifies: a verifier that only refuses is not proven", { path: "fixtures/conformance.json" }));
  const missing = REQUIRED_GRANT_CODES.filter((code) => !codes.has(code));
  if (missing.length > 0) {
    findings.push(
      error("grants.cases", `the recording proves no ${missing.join(", ")}: #40's negative cases settle where the per-plugin copies disagreed`, {
        path: "fixtures/conformance.json",
        fix: "Record one case for each required refusal."
      })
    );
  }
  return findings;
}
function rpcConfirmationFindings(manifest, recorded, options = {}) {
  const calls = recorded?.calls ?? [];
  if (calls.length === 0) return [];
  const findings = [];
  for (const [index, call] of calls.entries()) {
    const method = typeof call.method === "string" ? call.method : "";
    const item = manifest.methods[method];
    if (item === void 0) {
      findings.push(error("rpc.method", `rpc.calls[${index}] names ${String(call.method)}, which is not a declared method`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (item.class === "read") continue;
    const expect = call.expect !== null && typeof call.expect === "object" ? call.expect : {};
    if (call.ask === "denied") {
      const refused = expect["code"] === "PERMISSION_DENIED";
      if (!refused) findings.push(error("rpc.confirmation", `${method} is class ${item.class}, and its recorded RPC call with the ask denied answers ${String(expect["code"])}, not PERMISSION_DENIED`, { path: "fixtures/conformance.json", fix: "Refuse a non-read method over RPC without an answered ask or a valid grant." }));
      continue;
    }
    if (call.grant !== void 0 && call.ask === "none" && expect["ok"] !== true) {
      findings.push(error("rpc.grant", `${method}'s RPC call presents a grant and answers ${String(expect["code"] ?? expect["ok"])}, not success`, { path: "fixtures/conformance.json" }));
    }
  }
  return findings;
}

// src/internal/host/errors.ts
var HostError = class extends Error {
  code;
  next;
  constructor(code, message, next) {
    super(`${code}: ${message.replace(/[.!?]$/, "")}. Next step: ${next}`);
    this.name = "HostError";
    this.code = code;
    this.next = next;
  }
};

// src/internal/host/activation.ts
var sleepFor = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
async function waitForActivation(options) {
  const timeoutMs = options.timeoutMs ?? 1e4;
  const pollMs = options.pollMs ?? 25;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepFor;
  const started = now();
  for (; ; ) {
    if (await options.isActive()) return;
    const elapsed = now() - started;
    if (elapsed >= timeoutMs) {
      throw new HostError("HOST_TIMEOUT", `the plugin did not become active within ${timeoutMs} ms`, "read the host log for a setup error; T1 cannot call a plugin before it finishes setup");
    }
    await sleep(Math.min(pollMs, Math.max(1, timeoutMs - elapsed)));
  }
}

// src/internal/host/codemode.ts
function createCodeMode(session, options = {}) {
  let counter = 0;
  const used = /* @__PURE__ */ new Set();
  const nextID = options.nextID ?? (() => `${session.sessionID}:call:${++counter}`);
  const take = (id) => {
    const candidate = id ?? nextID();
    if (used.has(candidate)) throw new Error(`HOST_CALL_ID: the call id ${candidate} is already used in this session. Next step: let the harness make the id, or pass a new one`);
    used.add(candidate);
    return candidate;
  };
  const calls = [];
  const make = (call, codemode) => {
    const made = {
      tool: call.tool,
      input: call.input,
      id: take(call.id),
      codemode,
      sessionID: session.sessionID,
      agent: session.agent,
      messageID: session.messageID
    };
    calls.push(made);
    return made;
  };
  return {
    calls,
    topLevel: (call) => make(call, false),
    nested: (call) => make(call, true)
  };
}

// src/internal/host/mcp.ts
function discoveredProtocol(body) {
  if (typeof body === "object" && body !== null) {
    const protocol = body["protocol"];
    if (typeof protocol === "string" && protocol !== "") return protocol;
  }
  return "2026-07-28";
}
async function connectMcpServer(config, transport) {
  const sent = [];
  const initialize = async () => {
    sent.push("initialize");
    const answer = await transport.request("initialize", { protocolVersion: "legacy" });
    if (answer.status >= 200 && answer.status < 300) return { status: "initialized", protocol: "legacy", sent };
    return { status: "failed", code: answer.status, reason: `initialize answered ${answer.status}`, sent };
  };
  if (config.protocol === "legacy") return initialize();
  sent.push("server/discover");
  const discovered = await transport.request("server/discover");
  if (discovered.status >= 200 && discovered.status < 300) return { status: "discovered", protocol: discoveredProtocol(discovered.body), sent };
  if (discovered.status === 401 || discovered.status === 403) {
    return {
      status: "failed",
      code: discovered.status,
      reason: `the server rejected server/discover with ${discovered.status}; a ${discovered.status} ends the attempt and no initialize follows`,
      sent
    };
  }
  if (config.protocol === "2026-07-28") {
    return { status: "failed", code: discovered.status, reason: `server/discover answered ${discovered.status}`, sent };
  }
  return initialize();
}
function mcpAddress(config) {
  const address = config.url ?? config.command?.join(" ");
  if (address === void 0) throw new HostError("HOST_MCP", "the MCP server has no url and no command", "give the server a url, or a command for a local server");
  return address;
}

// src/internal/host/automation.ts
async function createAutomation(host, api, spec, options = {}) {
  if (host.kind === "sdk" && options.allowScheduler !== true) {
    return { status: "skipped", reason: "the embedded @opencode/sdk host never runs automations; only @opencode/server starts the scheduler" };
  }
  const created = await api.create(spec);
  return { status: "created", id: created.id };
}
function automationApi(client) {
  const api = client.experimental?.automation;
  if (api === void 0 || typeof api.create !== "function") {
    const legacy = client.experimental?.schedule !== void 0;
    throw new HostError(
      "HOST_API_GONE",
      legacy ? "experimental.schedule is gone from OpenCode 2.4" : "this host has no experimental.automation API",
      "create the automation with ctx.experimental.automation.create, which posts to /api/experimental/automation"
    );
  }
  return api;
}

// src/internal/host/turn.ts
var TurnLog = class {
  started = /* @__PURE__ */ new Set();
  held = /* @__PURE__ */ new Map();
  order = [];
  seen = [];
  /** Accept one event. A start releases its turn's held steps after itself; an early step is held. */
  push(event) {
    this.seen.push(event);
    if (event.type === "tool.step" && !this.started.has(event.turnID)) {
      const held = this.held.get(event.turnID) ?? [];
      held.push(event);
      this.held.set(event.turnID, held);
      if (!this.order.includes(event.turnID)) this.order.push(event.turnID);
      return [];
    }
    if (event.type === "turn.start" && !this.started.has(event.turnID)) {
      this.started.add(event.turnID);
      const held = this.held.get(event.turnID) ?? [];
      this.held.delete(event.turnID);
      return [event, ...held];
    }
    return [event];
  }
  /** Whatever is still held, in arrival order, for a test that ends with a turn that never started. */
  flush() {
    const held = this.order.flatMap((turn) => this.held.get(turn) ?? []);
    this.held.clear();
    this.order.length = 0;
    return held;
  }
  /** Everything pushed, in arrival order, for a diagnostic. */
  get events() {
    return this.seen;
  }
};

// src/internal/host/index.ts
var HOST_DENIALS = /* @__PURE__ */ new Set(["Permission.BlockedError", "Permission.DeclinedError", "Permission.CorrectedError"]);
function reportedCode(error2) {
  if (typeof error2 !== "object" || error2 === null) return void 0;
  const held = error2;
  const data = held.data?.code;
  if (typeof data === "string" && data !== "") return data;
  return typeof held.code === "string" && held.code !== "" ? held.code : void 0;
}
function codeOf(error2) {
  const reported = reportedCode(error2);
  if (reported !== void 0) return reported;
  const message = error2 instanceof Error ? error2.message : typeof error2 === "string" ? error2 : "";
  const leading = /^([A-Z][A-Z0-9_]*): /.exec(message)?.[1];
  if (leading !== void 0) return leading;
  for (const holder of [error2, typeof error2 === "object" && error2 !== null ? error2.error : void 0]) {
    const tag = typeof holder === "object" && holder !== null ? holder._tag : void 0;
    if (typeof tag === "string" && HOST_DENIALS.has(tag)) return "PERMISSION_DENIED";
  }
  return "UNAVAILABLE";
}
function assertFailure(error2) {
  const raw = error2 instanceof Error ? error2.message : String(error2);
  const secrets = secretKinds(raw);
  const message = secrets.length === 0 ? raw.slice(0, 300) : `the host's error held a secret (${secrets.join(", ")}), which the kit did not print`;
  return { ok: false, code: codeOf(error2), message };
}
var SDK = ["@opencode", "sdk"].join("/");
var PLUGIN_HOST = ["@opencode", "plugin", "host"].join("/");
async function load(specifier) {
  try {
    return await import(specifier);
  } catch {
    return void 0;
  }
}
async function pluginEntry(directory) {
  const host = await load(PLUGIN_HOST);
  if (host === void 0) throw new HostError("HOST_DEPENDENCY", "the conformance host cannot load @opencode/plugin", "install @opencode/plugin 2.4.1 as a devDependency, and run T1 again");
  const resolved = host.resolve({ directory });
  if (resolved.server === void 0) throw new HostError("HOST_ENTRY", `${directory} has no server entry: package.json maps no ./server or ., and there is no index file`, 'add an exports["./server"] entry or an index.js to the plugin');
  return { entry: resolved.server, module: await host.load(resolved.server) };
}
function definitionOf(module) {
  if (module === null || typeof module !== "object") return void 0;
  const record = module;
  const candidate = record["default"] ?? record["plugin"];
  if (candidate === null || typeof candidate !== "object") return void 0;
  const definition = candidate;
  if (typeof definition["id"] !== "string" || typeof definition["setup"] !== "function") return void 0;
  return definition;
}
function toolOf(registration, namespace) {
  const options = registration["options"] ?? {};
  const codemode = options["codemode"];
  return {
    id: `${namespace}_${String(registration["name"] ?? "")}`,
    name: String(registration["name"] ?? ""),
    description: String(registration["description"] ?? ""),
    namespace: typeof options["namespace"] === "string" ? options["namespace"] : namespace,
    permission: typeof options["permission"] === "string" ? options["permission"] : "",
    input: registration["input"],
    output: registration["output"],
    codemode: typeof codemode === "boolean" || codemode !== null && typeof codemode === "object" ? codemode : false
  };
}
async function createHost(options) {
  let loaded;
  try {
    loaded = await pluginEntry(options.directory);
  } catch (cause) {
    return emptyRun(options, void 0, cause instanceof Error ? cause.message : String(cause));
  }
  const definition = definitionOf(loaded.module);
  if (definition === void 0) {
    return emptyRun(options, loaded.entry, `the server entry exports no Plugin.define({ id, setup }) value`);
  }
  const sdk = await load(SDK);
  if (sdk === void 0) {
    return emptyRun(options, loaded.entry, "the conformance host cannot load @opencode/sdk 2.4.1");
  }
  const tools = [];
  let namespace;
  let rpc;
  let assertAction;
  const asks = [];
  let setupError;
  let setupDone = false;
  const pluginOptions = options.options ?? {};
  const wrapper = {
    id: definition.id,
    async setup(context) {
      const real = context;
      const toolDomain = real["tool"];
      const permission = real["permission"];
      const rpcDomain = real["rpc"];
      const toolProxy = new Proxy(toolDomain, {
        get(toolTarget, field2) {
          if (field2 === "transform") {
            return (callback) => toolTarget.transform((editor) => {
              const proxied = new Proxy(editor, {
                get(editorTarget, editorField) {
                  if (editorField === "namespace") {
                    return (value3) => {
                      namespace = value3;
                      return editorTarget["namespace"](value3);
                    };
                  }
                  if (editorField === "add") {
                    return (registration) => {
                      const recorded = toolOf(registration, namespace?.name ?? definition.id);
                      const at = tools.findIndex((tool) => tool.permission === recorded.permission);
                      if (at === -1) tools.push(recorded);
                      else tools[at] = recorded;
                      return editorTarget["add"](registration);
                    };
                  }
                  const value2 = Reflect.get(editorTarget, editorField);
                  return typeof value2 === "function" ? value2.bind(editorTarget) : value2;
                }
              });
              return callback(proxied);
            });
          }
          const value = Reflect.get(toolTarget, field2);
          return typeof value === "function" ? value.bind(toolTarget) : value;
        }
      });
      const rpcProxy = new Proxy(rpcDomain, {
        get(rpcTarget, field2) {
          if (field2 === "register") {
            return (registration, handlers) => {
              rpc = {
                id: String(registration["id"] ?? ""),
                methods: Object.keys(registration["methods"] ?? {}),
                events: Object.keys(registration["events"] ?? {})
              };
              return rpcTarget.register(registration, handlers);
            };
          }
          const value = Reflect.get(rpcTarget, field2);
          return typeof value === "function" ? value.bind(rpcTarget) : value;
        }
      });
      const permissionProxy = new Proxy(permission, {
        get(permissionTarget, field2) {
          if (field2 === "assert") {
            return async (input) => {
              asks.push({ action: input.action, resources: input.resources ?? [] });
              return permissionTarget.assert(input);
            };
          }
          const value = Reflect.get(permissionTarget, field2);
          return typeof value === "function" ? value.bind(permissionTarget) : value;
        }
      });
      assertAction = (input) => permissionProxy.assert(input);
      const proxy = new Proxy(real, {
        get(target, property) {
          if (property === "options") return pluginOptions;
          if (property === "tool") return toolProxy;
          if (property === "rpc") return rpcProxy;
          if (property === "permission") return permissionProxy;
          return Reflect.get(target, property);
        }
      });
      try {
        const cleanup = await definition.setup(proxy);
        if (typeof cleanup === "function") return cleanup;
        return void 0;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const secrets = secretKinds(message);
        setupError = secrets.length === 0 ? message.slice(0, 300) : `the plugin's setup error held a secret (${secrets.join(", ")}), which the kit did not print`;
        throw cause;
      } finally {
        setupDone = true;
      }
    }
  };
  let host;
  try {
    host = await sdk.OpenCode.create({
      plugins: [wrapper],
      config: { directory: options.directory },
      app: { name: "opencode", version: options.version },
      log: { level: "error", emit: () => void 0 }
    });
  } catch (cause) {
    return emptyRun(options, loaded.entry, `the embedded OpenCode host did not start: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  let sessionID;
  try {
    const session = await host.sessions.create({
      location: { directory: options.directory },
      agent: options.agent ?? "build",
      permissions: options.sessionRules ?? []
    });
    sessionID = session.id;
    await host.sessions.prompt({ sessionID: session.id, text: "activate the conformance plugin", delivery: "queue" }).catch(() => void 0);
    await waitForActivation({
      isActive: () => setupDone || setupError !== void 0,
      ...options.timeoutMs === void 0 ? {} : { timeoutMs: options.timeoutMs }
    });
    await waitForActivation({
      isActive: async () => {
        const list2 = await host.plugin.list({ location: { directory: options.directory } }).catch(() => void 0);
        return list2?.data.some((entry) => entry.id === definition.id) ?? false;
      },
      ...options.timeoutMs === void 0 ? {} : { timeoutMs: options.timeoutMs }
    }).catch(() => void 0);
  } catch (cause) {
    setupError ??= cause instanceof Error ? cause.message : String(cause);
  }
  const agents = sessionID === void 0 ? [] : (await host.agent.list({ location: { directory: options.directory } }).catch(() => ({ data: [] }))).data.map((agent) => ({ id: agent.id, permissions: agent.permissions }));
  const refusal = setupError !== void 0 && setupError.startsWith("HOST_UNTESTED:") ? setupError : void 0;
  const failure = setupError !== void 0 && refusal === void 0 ? setupError : void 0;
  let closed = false;
  return {
    host: "embedded-sdk",
    version: options.version,
    entry: loaded.entry,
    definition,
    ...namespace === void 0 ? {} : { namespace },
    tools,
    ...rpc === void 0 ? {} : { rpc },
    agents,
    asks,
    ...refusal === void 0 ? {} : { refusal },
    ...failure === void 0 ? {} : { failure },
    ...sessionID === void 0 ? {} : { sessionID },
    async call(method, input, callOptions = {}) {
      const id = callOptions.sessionID ?? (await host.sessions.create({ location: { directory: options.directory }, agent: options.agent ?? "build", permissions: callOptions.rules ?? [] })).id;
      try {
        const answer = await host.rpc.call({ rpcID: definition.id, method, input: { sessionID: id, input }, location: { directory: options.directory } });
        return { ok: true, output: answer?.output };
      } catch (cause) {
        const error2 = cause;
        return { ok: false, code: error2.data?.code ?? error2.type ?? "UNAVAILABLE", message: error2.message ?? String(cause) };
      }
    },
    async session(rules) {
      const created = await host.sessions.create({ location: { directory: options.directory }, agent: options.agent ?? "build", permissions: rules });
      return created.id;
    },
    async assert(input) {
      if (assertAction === void 0) return { ok: false, code: "UNAVAILABLE", message: "the plugin never reached setup, so this run has no permission domain" };
      try {
        await assertAction({ sessionID: input.sessionID, action: input.action, resources: input.resources ?? ["*"] });
        return { ok: true };
      } catch (error2) {
        return assertFailure(error2);
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await host.close().catch(() => void 0);
    }
  };
}
function emptyRun(options, entry, failure) {
  return {
    host: "embedded-sdk",
    version: options.version,
    ...entry === void 0 ? {} : { entry },
    tools: [],
    agents: [],
    asks: [],
    failure,
    async call() {
      return { ok: false, code: "UNAVAILABLE", message: failure };
    },
    async session() {
      return "";
    },
    async assert() {
      return { ok: false, code: "UNAVAILABLE", message: failure };
    },
    async close() {
    }
  };
}

// src/internal/conformance/host.ts
var UNSUPPORTED_HOST = "2.5.0";
var nodeMajor = Number(process.versions.node.split(".")[0]);
function hostRuntimeProblem(nodeVersion = process.versions.node, bunVersion = process.versions.bun ?? null) {
  if (bunVersion !== null) return void 0;
  if (Number(nodeVersion.split(".")[0]) >= 24) return void 0;
  return error("T1.host-unavailable", "T1 needs Node 24 or Bun", {
    path: "package.json",
    fix: "Run T1 on Node 24 or Bun; Node 22 cannot parse the embedded host's `await using`."
  });
}
async function inspectHost(directory, manifest, host, options = {}) {
  const runtime = hostRuntimeProblem();
  if (runtime !== void 0) return { findings: [runtime] };
  const supported = hostInRange(host);
  const pluginOptions = { access: "all", ...options.accounts === void 0 || options.accounts.length === 0 ? {} : { accounts: Object.fromEntries(options.accounts.map((alias) => [alias, {}])) } };
  if (!supported) {
    const refused = await createHost({ directory, version: host, pluginId: manifest.plugin.name, options: { ...pluginOptions, allowUntestedHost: false } });
    try {
      if (refused.refusal === void 0) {
        return {
          run: refused,
          findings: [
            error("T1.unsupported-host", `OpenCode ${host} is outside ${OPENCODE_RANGE}, and the plugin ${refused.failure === void 0 ? "started" : `failed with "${refused.failure}"`} instead of refusing with HOST_UNTESTED`, {
              path: "capabilities.plugin.host",
              fix: "Refuse an untested host with HOST_UNTESTED and a next step, unless options.allowUntestedHost is true."
            })
          ]
        };
      }
      const findings = [];
      if (!refused.refusal.includes("Next step: ")) findings.push(error("T1.unsupported-host", `the refusal of OpenCode ${host} reads "${refused.refusal.slice(0, 160)}", and every failure reads CODE: What happened. Next step: What to do.`, { path: "capabilities.plugin.host" }));
      return { run: refused, findings, checks: ["T1.unsupported-host"] };
    } finally {
      await refused.close();
    }
  }
  const run = await createHost({ directory, version: host, pluginId: manifest.plugin.name, options: pluginOptions });
  try {
    if (run.refusal !== void 0) {
      return {
        run,
        findings: [error("T1.load", `the plugin refused OpenCode ${host}, which its manifest says it supports: ${run.refusal.slice(0, 160)}`, { path: "capabilities.plugin.host" })]
      };
    }
    if (run.failure !== void 0) {
      const dependency = run.failure.includes("@opencode/sdk") ? "@opencode/sdk" : run.failure.includes("@opencode/plugin") ? "@opencode/plugin" : void 0;
      return {
        run,
        findings: [
          dependency === void 0 ? error("T1.load", `${manifest.plugin.name} does not load on OpenCode ${host}: ${run.failure}`, { path: run.entry ?? "package.json", fix: "Build the plugin and fix the error setup reports." }) : error("T1.host", `the conformance host cannot load ${dependency}`, { path: "package.json", fix: `Add ${dependency} 2.4.1 as a devDependency and run T1 again.` })
        ]
      };
    }
    if (run.definition === void 0) return { run, findings: [error("T1.load", `${manifest.plugin.name} loads on OpenCode ${host} and exports no Plugin.define({ id, setup }) value`, { path: "package.json" })] };
    const findings = [];
    if (run.definition.id !== manifest.plugin.name) findings.push(error("T1.id", `the plugin's id is ${run.definition.id}, and capabilities.plugin.name is ${manifest.plugin.name}`, { path: "package.json" }));
    if (run.namespace === void 0) findings.push(error("T1.doors", `${manifest.plugin.name} registers no tool namespace`, { path: run.entry, fix: "Call ctx.tool.namespace({ name, description }) before adding tools." }));
    else if (run.namespace.name !== manifest.plugin.name) findings.push(error("T1.doors", `the tool namespace is ${run.namespace.name}, and the plugin's name is ${manifest.plugin.name}`, { path: run.entry }));
    findings.push(...doorFindings(manifest, run));
    findings.push(...codemodeFindings(manifest, run));
    findings.push(...methodFindings(manifest, run));
    findings.push(...eventFindings(manifest, run));
    findings.push(...pinnedFindings(manifest, run));
    findings.push(...await permissionFindings(directory, manifest, host, run, pluginOptions, options.accounts ?? []));
    findings.push(...await rpcFindings(manifest, run, options.inputs ?? {}, options.accounts ?? []));
    findings.push(...await grantAliasFindings(manifest, run, options.accounts ?? []));
    if (options.realAccounts === true) findings.push(...await accountFindings2(manifest, run, options.accounts ?? [], options.inputs ?? {}, options.accountMethod, options.accountCursor));
    const checks = ["T1.id", "T1.doors", "T1.codemode", "T1.methods", "T1.events", "T1.pinned", "T1.permissions"];
    if (run.rpc !== void 0) checks.push("T1.rpc-confirmation");
    if (grantAliasApplies(manifest, options.accounts ?? [])) checks.push("T1.grant-alias");
    if (options.realAccounts === true && manifest.accounts !== void 0 && (options.accounts ?? []).length >= 2) checks.push("T1.accounts");
    return { run, findings, checks };
  } finally {
    await run.close();
  }
}
async function hostFindings(directory, manifest, host, options = {}) {
  return [...(await inspectHost(directory, manifest, host, options)).findings];
}
function doorFindings(manifest, run) {
  const findings = [];
  const name = manifest.plugin.name;
  const declared = Object.keys(manifest.methods).filter((method) => !method.startsWith("mcp:"));
  const permissions = new Set(run.tools.map((tool) => tool.permission));
  for (const method of declared) {
    if (!permissions.has(`${name}.${method}`)) findings.push(error("T1.doors", `${method} is declared and no agent tool has the permission ${name}.${method}`, { path: `capabilities.methods.${method}`, fix: "Register every method through contract.register, which adds the tool and its permission." }));
    if (run.rpc === void 0 || !run.rpc.methods.includes(method)) findings.push(error("T1.doors", `${method} is declared and the RPC registration ${run.rpc?.id ?? "(none)"} does not carry it`, { path: `capabilities.methods.${method}`, fix: "Register every method through contract.register, whose one RPC registration carries them all." }));
  }
  for (const tool of run.tools) {
    if (tool.permission === "") {
      findings.push(error("T1.doors", `the tool ${tool.id} carries no permission, and every tool is permitted as ${name}.<method>`, { path: run.entry }));
      continue;
    }
    if (!tool.permission.startsWith(`${name}.`)) {
      findings.push(error("T1.doors", `the tool ${tool.id} is permitted as ${tool.permission}, outside the plugin's namespace ${name}.`, { path: run.entry }));
      continue;
    }
    const method = tool.permission.slice(name.length + 1);
    if (!declared.includes(method)) findings.push(error("T1.doors", `the tool ${tool.id} is registered for ${method}, which capabilities.methods does not declare`, { path: run.entry }));
    if (tool.namespace !== name) findings.push(error("T1.doors", `the tool ${tool.id} is in the namespace ${tool.namespace}, not ${name}`, { path: run.entry }));
  }
  if (run.rpc !== void 0 && run.rpc.id !== name) findings.push(error("T1.doors", `the RPC registration's id is ${run.rpc.id}, and the plugin's name is ${name}`, { path: run.entry }));
  for (const method of run.rpc?.methods ?? []) {
    if (!declared.includes(method)) findings.push(error("T1.doors", `the RPC registration carries ${method}, which capabilities.methods does not declare`, { path: run.entry }));
  }
  return findings;
}
function codemodeFindings(manifest, run) {
  const findings = [];
  for (const tool of run.tools) {
    const method = tool.permission.startsWith(`${manifest.plugin.name}.`) ? tool.permission.slice(manifest.plugin.name.length + 1) : void 0;
    if (tool.codemode === false) findings.push(error("T1.codemode", `${tool.permission || tool.id} is not exposed to Code Mode`, { path: method === void 0 ? void 0 : `capabilities.methods.${method}`, fix: "Every method is in Code Mode (\xA79); do not pass codemode: false." }));
    const pinned = typeof tool.codemode === "object" && tool.codemode !== null && tool.codemode.pinned === true;
    if (pinned && method !== void 0 && manifest.methods[method]?.pinned !== true) findings.push(error("T1.codemode", `${tool.permission} is pinned in Code Mode, and capabilities.methods does not declare pinned: true`, { path: `capabilities.methods.${method}.pinned` }));
    if (!pinned && method !== void 0 && manifest.methods[method]?.pinned === true) findings.push(error("T1.codemode", `${method} declares pinned: true and its Code Mode entry is not pinned`, { path: `capabilities.methods.${method}.pinned` }));
  }
  return findings;
}
function methodFindings(manifest, run) {
  const findings = [];
  for (const [method, item] of Object.entries(manifest.methods)) {
    if (method.startsWith("mcp:")) continue;
    if (item.description === void 0 && item.input === void 0) continue;
    const tool = run.tools.find((entry) => entry.permission === `${manifest.plugin.name}.${method}`);
    if (tool === void 0) continue;
    if (item.description !== void 0 && item.description !== tool.description) {
      findings.push(
        error("T1.methods", `${method}'s description in capabilities.methods does not match the live tool's`, {
          path: `capabilities.methods.${method}.description`,
          fix: `Generate capabilities.methods.${method}.description from the handler's tool description.`
        })
      );
    }
    if (item.input !== void 0 && !sameJson(item.input, tool.input)) {
      findings.push(
        error("T1.methods", `${method}'s input schema in capabilities.methods does not match the live tool's`, {
          path: `capabilities.methods.${method}.input`,
          fix: `Generate capabilities.methods.${method}.input from the live tool's input schema, including account and a commit's planId.`
        })
      );
    }
  }
  return findings;
}
function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}
function eventFindings(manifest, run) {
  const declared = Object.keys(manifest.events);
  const registered = run.rpc?.events ?? [];
  const findings = [];
  for (const event of declared) if (!registered.includes(event)) findings.push(error("T1.events", `the RPC registration does not carry the declared bus event ${event}`, { path: `capabilities.events.${event}`, fix: "Register the events block with the manifest's events through contract.register." }));
  for (const event of registered) if (!declared.includes(event)) findings.push(error("T1.events", `the RPC registration carries ${event}, which capabilities.events does not declare`, { path: "capabilities.events" }));
  return findings;
}
function pinnedFindings(manifest, run) {
  const findings = [];
  const pinned = run.tools.filter((tool) => typeof tool.codemode === "object" && tool.codemode !== null && tool.codemode.pinned === true);
  if (pinned.length > 1) findings.push(error("T1.pinned", `${pinned.length} tools are pinned, and at most one is`, { path: "capabilities.methods" }));
  for (const [method, item] of Object.entries(manifest.methods)) {
    if (item.pinned !== true || method.startsWith("mcp:")) continue;
    const tool = run.tools.find((entry) => entry.permission === `${manifest.plugin.name}.${method}`);
    if (tool === void 0) continue;
    const tokens = Math.ceil(JSON.stringify([run.namespace?.description ?? "", tool.description, tool.input]).length / 4);
    if (tokens > 1e3) findings.push(error("T1.pinned-budget", `${method}'s pinned signature is about ${tokens} tokens, over the 1,000-token budget`, { path: `capabilities.methods.${method}.pinned`, fix: "Trim the pinned tool's description or input schema, or unpin it." }));
  }
  return findings;
}
function mcpActions(name, tool, aliases) {
  const declared = aliases.length === 0 ? ["default"] : aliases;
  return declared.flatMap((alias) => {
    const server = serverOf(name, alias, declared);
    return server.ok ? [toolAction(server.value, tool)] : [];
  });
}
async function permissionFindings(directory, manifest, host, all, options, aliases) {
  const findings = [];
  if (all.agents.every((agent) => agent.permissions.length === 0)) {
    return [error("T1.permissions", `${manifest.plugin.name} installs no permission rules, so an agent keeps its own defaults`, { path: "src/index.ts", fix: "Generate the access rules into every agent with ctx.agent.transform, as contract \xA76 requires." })];
  }
  const levels = Object.values(manifest.methods).every((item) => item.class === "read" && item.effect === void 0) ? ["all"] : ["all", "ask-changes", "read-only"];
  for (const level of levels) {
    const run = level === "all" ? all : await createHost({ directory, version: host, pluginId: manifest.plugin.name, options: { ...options, access: level } });
    try {
      if (run.failure !== void 0) continue;
      for (const agent of run.agents) {
        if (evaluate(agent.permissions, "*", "*") === "deny") continue;
        for (const [method, item] of Object.entries(manifest.methods)) {
          const expected = effectFor(item, level);
          const actions = method.startsWith("mcp:") ? mcpActions(manifest.plugin.name, method.slice("mcp:".length), aliases) : [`${manifest.plugin.name}.${method}`];
          for (const action of actions) {
            const actual = evaluate(agent.permissions, action, "*");
            if (actual === expected) continue;
            findings.push(error("T1.permissions", `access ${level} gives ${agent.id} ${actual} for ${action}, and the contract gives ${expected}`, { path: `capabilities.methods.${method}`, fix: "Generate the access rules from the access setting and each method's class and effect." }));
          }
        }
      }
    } finally {
      if (level !== "all") await run.close();
    }
  }
  return findings;
}
async function rpcFindings(manifest, run, inputs, aliases) {
  if (run.rpc === void 0) return [];
  const findings = [];
  const rules = [{ action: "*", resource: "*", effect: "allow" }];
  const account = aliases[0];
  for (const [method, item] of Object.entries(manifest.methods)) {
    if (item.class === "read" || method.startsWith("mcp:")) continue;
    let input = { ...inputs[method] ?? {} };
    if (item.commits !== void 0) {
      const planned = await run.call(item.commits, { ...inputs[item.commits] ?? {}, ...account === void 0 ? {} : { account } }, { rules });
      const planId = planned.ok && planned.output !== null && typeof planned.output === "object" ? planned.output.planId : void 0;
      if (typeof planId !== "string") {
        findings.push(warning("T1.rpc-confirmation", `${method} commits ${item.commits}, whose plan did not answer a planId, so LD-5 is unproven for it`, { path: `capabilities.methods.${method}` }));
        continue;
      }
      input = { planId };
    } else if (account !== void 0 && item.accounts === "optional" && input["account"] === void 0) {
      input = { ...input, account };
    }
    const answer = await run.call(method, input, { rules });
    if (answer.ok || answer.code !== "PERMISSION_DENIED") {
      findings.push(error("T1.rpc-confirmation", `${method} is class ${item.class} and its RPC call ran with an allow rule and no grant${answer.ok ? "" : ` (${answer.code})`}`, { path: `capabilities.methods.${method}`, fix: "Refuse a non-read method over RPC unless an ask was answered or a valid action grant verifies (contract \xA78)." }));
    }
  }
  return findings;
}
function grantAliasApplies(manifest, aliases) {
  return aliases.length >= 2 && Object.keys(manifest.methods).some((method) => method.startsWith("mcp:")) && manifest.sources.some((entry) => (entry.operations ?? []).some((operation) => !operation.includes(".")));
}
var GRANT_ASSERT_TIMEOUT_MS = 1500;
async function assertWithin(run, input) {
  let timer;
  const late = new Promise((resolve2) => {
    timer = setTimeout(() => resolve2({ ok: false, code: "TIMEOUT", message: `the host did not answer the assert for ${input.action} within ${GRANT_ASSERT_TIMEOUT_MS} ms` }), GRANT_ASSERT_TIMEOUT_MS);
  });
  const asked = Promise.resolve(run.assert(input)).catch(() => ({ ok: false, code: "UNAVAILABLE", message: "the host's assert threw instead of answering; a host failure is reported as UNAVAILABLE" }));
  try {
    return await Promise.race([asked, late]);
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
async function grantAliasFindings(manifest, run, aliases) {
  if (!grantAliasApplies(manifest, aliases)) return [];
  const source = manifest.sources.find((entry) => (entry.operations ?? []).some((operation2) => !operation2.includes(".")));
  if (source === void 0) return [];
  const operation = (source.operations ?? []).find((entry) => !entry.includes("."));
  const first = aliases[0];
  const second = aliases[1];
  if (operation === void 0 || first === void 0 || second === void 0) return [];
  const works = serverOf(manifest.plugin.name, first, aliases);
  const other = serverOf(manifest.plugin.name, second, aliases);
  if (!works.ok || !other.ok) return [];
  const fenced = sessionRules(source, { source: source.id, account: first }, aliases);
  if (!fenced.ok) {
    return [error("T1.grant-alias", `a grant for ${first} could not compile to session rules: ${fenced.problems.join("; ")}`, { path: `capabilities.sources.${source.id}`, fix: "Declare an operation that derives a fenced rule for each alias." })];
  }
  const allowed = toolAction(works.value, operation);
  const denied = toolAction(other.value, operation);
  const sessionID = await run.session(fenced.value);
  const findings = [];
  const own = await assertWithin(run, { sessionID, action: allowed, resources: ["*"] });
  if (!own.ok) {
    findings.push(
      error("T1.grant-alias", `a grant for ${first} does not allow its own tool ${allowed} (${own.code}: ${own.message})`, {
        path: `capabilities.sources.${source.id}`,
        fix: "Derive the fenced rule from operationRule, so the granted alias's MCP tool is allowed."
      })
    );
  }
  const crossed = await assertWithin(run, { sessionID, action: denied, resources: ["*"] });
  if (crossed.ok) {
    findings.push(
      error("T1.grant-alias", `a grant for ${first} allows ${second}'s tool ${denied}, so one alias can reach another alias's tools`, {
        path: `capabilities.sources.${source.id}`,
        fix: "Compile the grant to the granted alias's server only, never to a wildcard that matches another alias."
      })
    );
  } else if (crossed.code !== "PERMISSION_DENIED") {
    findings.push(
      error("T1.grant-alias", `a grant for ${first} does not deny ${second}'s tool ${denied} with PERMISSION_DENIED: the host answered ${crossed.code} (${crossed.message})`, {
        path: `capabilities.sources.${source.id}`,
        fix: "Compile the grant to a deny for every other alias's server, so the other alias's tool is refused, not asked."
      })
    );
  }
  return findings;
}
async function accountFindings2(manifest, run, aliases, inputs, preferred, cursor) {
  if (manifest.accounts === void 0 || aliases.length < 2) return [];
  const method = preferred !== void 0 && manifest.methods[preferred]?.accounts === "optional" ? preferred : Object.keys(manifest.methods).find((name) => manifest.methods[name]?.accounts === "optional" && !name.startsWith("mcp:"));
  if (method === void 0) return [];
  const findings = [];
  const base = inputs[method] ?? {};
  const missing = await run.call(method, base, {});
  if (missing.ok || missing.code !== "ACCOUNT_REQUIRED") findings.push(error("T1.accounts", `${method} with two aliases and no account answered ${missing.ok ? "a result" : missing.code}, not ACCOUNT_REQUIRED`, { path: `capabilities.methods.${method}.accounts` }));
  const unknown = await run.call(method, { ...base, account: "nobodyhere" }, {});
  if (unknown.ok || unknown.code !== "ACCOUNT_UNKNOWN") findings.push(error("T1.accounts", `${method} with the unknown alias nobodyhere answered ${unknown.ok ? "a result" : unknown.code}, not ACCOUNT_UNKNOWN`, { path: `capabilities.methods.${method}.accounts` }));
  const cursorMethod = typeof cursor?.method === "string" && manifest.methods[cursor.method] !== void 0 ? cursor.method : method === "events_list" ? method : void 0;
  const first = typeof cursor?.account === "string" && aliases.includes(cursor.account) ? cursor.account : aliases[0];
  const second = typeof cursor?.other === "string" && aliases.includes(cursor.other) ? cursor.other : aliases[1];
  if (cursorMethod !== void 0 && first !== void 0 && second !== void 0 && first !== second) {
    const issued = await run.call(cursorMethod, { ...inputs[cursorMethod] ?? {}, account: first }, {});
    const token = issued.ok && issued.output !== null && typeof issued.output === "object" ? issued.output.cursor : void 0;
    if (typeof token === "string") {
      const crossed = await run.call(cursorMethod, { ...inputs[cursorMethod] ?? {}, account: second, cursor: token }, {});
      if (crossed.ok || crossed.code !== "CURSOR_INVALID") findings.push(error("T1.accounts", `${first}'s cursor read under ${second} answered ${crossed.ok ? "a page" : crossed.code}, not CURSOR_INVALID`, { path: `capabilities.methods.${cursorMethod}.accounts` }));
    }
  }
  return findings;
}

// src/internal/conformance/static.ts
import { existsSync, readFileSync as readFileSync3, readdirSync, statSync } from "node:fs";
import { join as join3, relative } from "node:path";

// src/internal/conformance/docs.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var DOC_FILES = [
  { file: "README.md", sections: ["capabilities", "errors"] },
  { file: "docs/capabilities.md", sections: ["capabilities"] },
  { file: "docs/configuration.md", sections: ["configuration"] },
  { file: "docs/accounts.md", sections: ["accounts"] },
  { file: "docs/automations.md", sections: ["automations"] }
];
var CODE_MEANING = {
  NEEDS_SIGN_IN: "the account is not signed in",
  SCOPE_MISSING: "the call needs a scope the person has not confirmed",
  ACCOUNT_REQUIRED: "the plugin serves several accounts and the call names none",
  ACCOUNT_UNKNOWN: "the call names an alias the plugin does not serve",
  ACCOUNT_MISMATCH: "the item belongs to another account",
  CURSOR_INVALID: "the cursor is malformed, or belongs to another source, account or scope",
  CURSOR_EXPIRED: "the provider no longer keeps the history the cursor names",
  RATE_LIMITED: "the provider asked the plugin to slow down",
  BUDGET_EXCEEDED: "the read would cost more than the person allows",
  SOURCE_DISABLED: "the person turned this source or action off",
  TOO_LARGE: "the answer is larger than the source's maxBytes",
  INPUT_INVALID: "the input does not match the method's schema",
  SOURCE_UNKNOWN: "the plugin declares no such source",
  SCHEMA_VIOLATION: "an answer does not keep the contract's shape",
  PERMISSION_DENIED: "the person's grant does not cover the call",
  PLAN_INVALID: "the plan is missing, or belongs to another method",
  PLAN_USED: "the plan was already used by an earlier commit",
  GRANT_INVALID: "the action grant did not verify, or was already spent",
  HOST_UNTESTED: "OpenCode is outside the plugin's tested range",
  OPTIONS_INVALID: "the plugin's options do not match their schema",
  UNAVAILABLE: "the provider could not be reached"
};
var cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
function list(values) {
  return values === void 0 || values.length === 0 ? "\u2014" : values.map((value) => `\`${cell(value)}\``).join(", ");
}
function renderGeneratedDocs(manifest) {
  return {
    capabilities: renderCapabilities(manifest),
    errors: renderErrors(manifest),
    configuration: renderConfiguration(manifest),
    accounts: renderAccounts(manifest),
    automations: renderAutomations(manifest)
  };
}
function renderCapabilities(manifest) {
  const methods = ["| Method | Class | Accounts | Operations |", "|---|---|---|---|"];
  for (const [method, item] of Object.entries(manifest.methods)) {
    methods.push(`| \`${cell(method)}\` | ${cell(item.class)} | ${item.accounts ?? "none"} | ${list(item.operations)} |`);
  }
  const sources = ["| Source | Kind | Reads or output | Method | Cost |", "|---|---|---|---|---|"];
  for (const source of manifest.sources) {
    sources.push(`| \`${cell(source.id)}\` | ${source.kind} | \`${cell(source.kind === "events" ? source.reads : source.output)}\` | \`${cell(source.method)}\` | ${source.cost.class} |`);
  }
  const actions = ["| Action | Effect | Preview | Commit |", "|---|---|---|---|"];
  for (const action of manifest.actions) {
    actions.push(`| \`${cell(action.id)}\` | ${action.effect} | \`${cell(action.preview)}\` | \`${cell(action.commit)}\` |`);
  }
  const events = Object.keys(manifest.events);
  return [
    "### Methods",
    "",
    ...methods,
    "",
    "### Sources",
    "",
    ...sources,
    "",
    "### Actions",
    "",
    actions.length > 2 ? actions.join("\n") : "None.",
    "",
    "### Bus events",
    "",
    events.length === 0 ? "None." : events.map((event) => `\`rpc.${manifest.plugin.name}.${event}\``).join(", ")
  ].join("\n");
}
function renderErrors(manifest) {
  const rows = ["| Code | Meaning |", "|---|---|"];
  for (const name of ERROR_CODES) rows.push(`| \`${name}\` | ${CODE_MEANING[name] ?? "a failure the contract defines"} |`);
  for (const [name, item] of Object.entries(manifest.errors ?? {})) rows.push(`| \`${cell(name)}\` | ${cell(item.meaning)}, shown in ${item.surface} |`);
  return rows.join("\n");
}
function typeOf(schema) {
  if (Array.isArray(schema["enum"])) return schema["enum"].map((value) => `\`${cell(value)}\``).join(" \\| ");
  if (Array.isArray(schema["type"])) return schema["type"].map(cell).join(" \\| ");
  if (typeof schema["type"] === "string") return cell(schema["type"]);
  if (schema["$ref"] !== void 0) return "profile";
  return "value";
}
function renderConfiguration(manifest) {
  const properties = manifest.options["properties"];
  if (properties === void 0) return "The plugin declares no options.";
  const rows = ["| Option | Type | Default | Description |", "|---|---|---|---|"];
  for (const [name, schema] of Object.entries(properties)) {
    const described = schema["description"] ?? schema["title"] ?? "";
    rows.push(`| \`${cell(name)}\` | ${typeOf(schema)} | ${schema["default"] === void 0 ? "\u2014" : `\`${cell(JSON.stringify(schema["default"]))}\``} | ${cell(described)} |`);
  }
  return rows.join("\n");
}
function renderAccounts(manifest) {
  const info = manifest.accounts;
  if (info === void 0) return "The plugin signs in to nothing.";
  const options = manifest.options;
  const properties = options["properties"] ?? {};
  const accounts = properties["accounts"] ?? {};
  const profile = accounts["additionalProperties"] ?? {};
  const fields = profile["properties"] ?? {};
  const rows = ["| Field | Type | Required |", "|---|---|---|"];
  const required = Array.isArray(profile["required"]) ? profile["required"] : [];
  for (const [field2, schema] of Object.entries(fields)) rows.push(`| \`${cell(field2)}\` | ${typeOf(schema)} | ${required.includes(field2) ? "yes" : "no"} |`);
  return [
    `Accounts are held by the **${info.via}** mechanism: ${info.via === "integration" ? "the plugin holds the credentials" : info.via === "mcp" ? "the vendor's MCP server holds them" : "the machine's own identity"}.`,
    "",
    fields === void 0 || Object.keys(fields).length === 0 ? "The profile has no fields." : rows.join("\n")
  ].join("\n");
}
function renderAutomations(manifest) {
  const events = manifest.sources.filter((source) => source.kind === "events");
  if (events.length === 0) return "The plugin declares no events source.";
  const rows = ["| Source | Method | Provider floor | Suggested | Signals |", "|---|---|---|---|---|"];
  for (const source of events) {
    const cadence = source.cadence;
    rows.push(
      `| \`${cell(source.id)}\` | \`tools.${manifest.plugin.name}.${cell(source.method)}\` | ${cadence?.providerMinMinutes === void 0 ? "\u2014" : `${cadence.providerMinMinutes} min`} | ${cadence?.suggestMinutes === void 0 ? "\u2014" : `${cadence.suggestMinutes} min`} | ${list(source.signals)} |`
    );
  }
  return rows.join("\n");
}
var START = (section) => `<!-- generated:${section} -->`;
var END = (section) => `<!-- /generated:${section} -->`;
function block(text, section) {
  const start = text.indexOf(START(section));
  const end = text.indexOf(END(section));
  if (start < 0 && end < 0) return { problem: `has no ${START(section)} block` };
  if (start < 0) return { problem: `closes ${section} without opening it` };
  if (end < 0) return { problem: `opens ${section} without closing it` };
  if (end < start) return { problem: `closes ${section} before opening it` };
  return { body: text.slice(start + START(section).length, end) };
}
var normalise = (text) => text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
var driftId = (section) => `T0.docs-${section}`;
function docsFindings(directory, manifest) {
  const findings = [];
  const rendered = renderGeneratedDocs(manifest);
  for (const doc of DOC_FILES) {
    const path = join2(directory, doc.file);
    let text;
    try {
      text = readFileSync2(path, "utf8");
    } catch {
      continue;
    }
    for (const section of doc.sections) {
      if (section === "accounts" && manifest.accounts === void 0) continue;
      if (section === "automations" && !manifest.sources.some((source) => source.kind === "events")) continue;
      const found = block(text, section);
      if (found.problem !== void 0) {
        findings.push(error(driftId(section), `${doc.file} ${found.problem}, so its ${section} section is not generated from the manifest`, { path: doc.file, fix: `Add ${START(section)} and ${END(section)} around the generated section, then run plugin-kit docs.` }));
        continue;
      }
      if (normalise(found.body ?? "") === normalise(rendered[section])) continue;
      findings.push(error(driftId(section), `${doc.file}'s ${section} section does not match capabilities: run plugin-kit docs`, { path: doc.file, fix: "Run plugin-kit docs and commit the result." }));
    }
    for (const match of text.matchAll(/<!-- generated:([a-z-]+) -->/g)) {
      const section = match[1] ?? "";
      if (doc.sections.includes(section)) continue;
      findings.push(warning("T0.docs-section", `${doc.file} carries a generated ${section} block, which is not a section this file generates`, { path: doc.file }));
    }
  }
  return findings;
}

// src/internal/conformance/static.ts
var NAMESPACE_LINE_MAX = 400;
var SKILL_DESCRIPTION_MAX = 300;
function frontMatter(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return void 0;
  const end = lines.indexOf("---", 1);
  if (end < 0) return void 0;
  return lines.slice(1, end).join("\n");
}
function field(text, key) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line));
  if (at < 0) return void 0;
  const first = (lines[at] ?? "").replace(new RegExp(`^${key}\\s*:\\s*`), "").trim();
  const block2 = ["|", ">", "|-", ">-", "|+", ">+"];
  if (first !== "" && !block2.includes(first)) {
    const parts = [unquote(first)];
    for (const line of lines.slice(at + 1)) {
      if (line.trim() === "") continue;
      if (!/^\s/.test(line)) break;
      parts.push(line.trim());
    }
    return parts.join(" ");
  }
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    body.push(line.replace(/^\s{2}/, ""));
  }
  const folded = first.startsWith(">");
  const joined = folded ? body.map((line) => line.trim()).filter((line) => line !== "").join(" ") : body.join("\n").trim();
  return unquote(joined);
}
function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}
function skillsOf(directory) {
  const root = join3(directory, "skills");
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at).sort()) {
      const path = join3(at, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (entry !== "SKILL.md") continue;
      const text = readFileSync3(path, "utf8");
      const matter = frontMatter(text) ?? "";
      const name = field(matter, "name");
      const description = field(matter, "description");
      found.push({ file: relative(directory, path), ...name === void 0 ? {} : { name }, ...description === void 0 ? {} : { description } });
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) walk(root);
  return found;
}
function proseFiles(directory) {
  const found = [];
  for (const entry of ["AGENTS.md", "README.md", "SUPPORTED.md"]) {
    if (existsSync(join3(directory, entry))) found.push(entry);
  }
  const docs = join3(directory, "docs");
  if (existsSync(docs) && statSync(docs).isDirectory()) {
    const walk = (at) => {
      for (const entry of readdirSync(at).sort()) {
        const path = join3(at, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (entry.endsWith(".md")) found.push(relative(directory, path));
      }
    };
    walk(docs);
  }
  for (const skill of skillsOf(directory)) found.push(skill.file);
  return [...new Set(found)];
}
function namedTools(text, plugin, underscored) {
  const named = [];
  const dotted = new RegExp(`tools\\.${plugin}\\.([a-z][a-z0-9_]*)`, "g");
  for (const match of text.matchAll(dotted)) named.push(match[1] ?? "");
  if (underscored) {
    const bare = new RegExp(`\\b${plugin}(?:-[a-z0-9]+)?_([a-z][a-z0-9_]*)`, "g");
    for (const match of text.matchAll(bare)) named.push(match[1] ?? "");
  }
  return named;
}
function pinnedEvidence(directory) {
  try {
    const value = JSON.parse(readFileSync3(join3(directory, "fixtures", "conformance.json"), "utf8"));
    return value.pinned !== null && typeof value.pinned === "object" && !Array.isArray(value.pinned) ? value.pinned : {};
  } catch {
    return {};
  }
}
function staticFindings(directory, manifest, options = {}) {
  const findings = [];
  const name = manifest.plugin.name;
  const line = options.namespace;
  if (line !== void 0) {
    if (line.length > NAMESPACE_LINE_MAX) {
      findings.push(
        error("T0.namespace-length", `the registered namespace line is ${line.length} characters, over the ${NAMESPACE_LINE_MAX}-character budget`, {
          path: "src/index.ts",
          fix: `Cut the namespace description to ${NAMESPACE_LINE_MAX} characters or fewer.`
        })
      );
    }
    if (/[\r\n]/.test(line)) findings.push(error("T0.namespace-length", "the registered namespace line is more than one line", { path: "src/index.ts", fix: "Write the namespace description as one line." }));
  } else {
    findings.push(warning("T0.namespace-unmeasured", "the registered namespace line was not measured, because no real host run happened", { fix: "Record the namespace text with plugin-kit record, or run plugin-kit check, whose T1 reading measures it live." }));
  }
  const skills = skillsOf(directory);
  if (skills.length === 0) {
    findings.push(warning("T0.skills-missing", `${name} ships no skills/<name>/SKILL.md`, { path: "skills", fix: `Add skills/${name}/SKILL.md, with a description of at most ${SKILL_DESCRIPTION_MAX} characters.` }));
  }
  for (const skill of skills) {
    const where = skill.name === void 0 ? skill.file : `${skill.name} (${skill.file})`;
    if (skill.description === void 0) {
      findings.push(error("T0.skill-length", `${where} has no description, and a skill's description is what an agent reads first`, { path: skill.file, fix: "Add a description to the SKILL.md front matter." }));
    } else if (skill.description.length > SKILL_DESCRIPTION_MAX) {
      findings.push(
        error("T0.skill-length", `${where}'s description is ${skill.description.length} characters, over the ${SKILL_DESCRIPTION_MAX}-character budget`, {
          path: skill.file,
          fix: `Cut the description to ${SKILL_DESCRIPTION_MAX} characters or fewer.`
        })
      );
    }
    const which = skill.name ?? skill.file.split("/").at(-2) ?? "";
    if (which !== name && !which.startsWith(`${name}-`)) {
      findings.push(error("T0.skill-name", `${where} is outside the namespace ${name}: a skill is ${name} or ${name}-<topic>`, { path: skill.file, fix: `Rename the skill to ${name} or ${name}-<topic>.` }));
    }
  }
  const declared = new Set(Object.keys(manifest.methods).filter((method) => !method.startsWith("mcp:")));
  const mcpWildcard = Object.hasOwn(manifest.methods, "mcp:*");
  const mcpTools = new Set(Object.keys(manifest.methods).filter((method) => method.startsWith("mcp:") && method !== "mcp:*").map((method) => method.slice("mcp:".length)));
  const guestTools = new Set(manifest.guestTools ?? []);
  const known = (method) => declared.has(method) || mcpTools.has(method) || mcpWildcard || guestTools.has(method);
  const seen = /* @__PURE__ */ new Set();
  for (const file of proseFiles(directory)) {
    const text = readFileSync3(join3(directory, file), "utf8");
    for (const method of namedTools(text, name, file.startsWith("skills/"))) {
      if (known(method)) continue;
      if (seen.has(`${file}\0${method}`)) continue;
      seen.add(`${file}\0${method}`);
      findings.push(
        error("T0.tools", `${file} names the tool ${name}_${method}, and capabilities.methods declares no ${method}`, {
          path: file,
          fix: `Name a declared method as tools.${name}.<method>, or declare ${method} in capabilities.methods.`
        })
      );
    }
  }
  for (const method of line === void 0 ? [] : namedTools(line, name, false)) {
    if (known(method)) continue;
    findings.push(error("T0.tools", `the namespace line names the tool ${name}_${method}, which capabilities.methods does not declare`, { path: "src/index.ts" }));
  }
  const evidence = pinnedEvidence(directory);
  for (const [method, item] of Object.entries(manifest.methods)) {
    if (item.pinned !== true) continue;
    const reason = evidence[method];
    if (typeof reason === "string" && reason.trim() !== "") continue;
    findings.push(
      (options.record === true ? warning : error)("T0.pinned", `${method} is pinned, and nothing declares the session data that shows most sessions call it`, {
        path: "capabilities.methods." + method,
        fix: `Add "pinned": { "${method}": "<the evidence>" } to fixtures/conformance.json, or unpin it.`
      })
    );
  }
  findings.push(...docsFindings(directory, manifest));
  return findings;
}

// src/internal/conformance/status.ts
var plain2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function busFindings(manifest, recorded, options = {}) {
  const findings = [];
  const declared = Object.keys(manifest.events);
  const emitted = (recorded?.emitted ?? []).filter((event) => typeof event === "string");
  if (recorded?.emitted === void 0) {
    if (declared.length > 0) {
      findings.push(
        options.record === true ? warning("events.recorded", `${manifest.plugin.name} declares ${declared.join(", ")} and records none`, { path: "fixtures/conformance.json" }) : error("events.recorded", `${manifest.plugin.name} declares ${declared.join(", ")} and records none: a declared event is one the plugin emits`, {
          path: "fixtures/conformance.json",
          fix: "Emit each declared event in a test and record it, or remove the declaration."
        })
      );
    }
    return findings;
  }
  for (const event of emitted) {
    if (!BUS_EVENTS.includes(event)) findings.push(error("events.declared", `the fixture records the bus event ${event}, which \xA710 does not define`, { path: "fixtures/conformance.json" }));
    else if (!declared.includes(event)) findings.push(error("events.declared", `the plugin emits ${event}, and capabilities.events does not declare it`, { path: `capabilities.events.${event}`, fix: `Add "${event}": {} to capabilities.events.` }));
  }
  for (const event of declared) {
    if (!emitted.includes(event)) findings.push(error("events.emitted", `${manifest.plugin.name} declares ${event} and no recorded test emitted it`, { path: `capabilities.events.${event}`, fix: "Emit it where the contract says it belongs, and record it, or remove the declaration." }));
  }
  return findings;
}
var STATUS_KEYS = ["name", "version", "host", "state", "accounts", "unguardedAgents", "nextStep"];
var ACCOUNT_KEYS = ["alias", "state", "owner", "reason"];
var HOST_KEYS = ["version", "range", "tested"];
function statusFindings(manifest, version, answer, aliases) {
  if (!plain2(answer)) return [error("status.shape", "the fixture records no status answer", { path: "fixtures/conformance.json" })];
  const findings = [];
  for (const key of Object.keys(answer)) if (!STATUS_KEYS.includes(key)) findings.push(error("status.shape", `status carries ${key}, which contract \xA711 does not define`, { path: "fixtures/conformance.json" }));
  if (answer["name"] !== manifest.plugin.name) findings.push(error("status.name", `status names ${JSON.stringify(answer["name"])}, not ${manifest.plugin.name}`, { path: "fixtures/conformance.json" }));
  if (answer["version"] !== version) findings.push(error("status.version", `status names version ${JSON.stringify(answer["version"])}, not the installed ${version}`, { path: "fixtures/conformance.json" }));
  if (!["ready", "needs_sign_in", "error"].includes(String(answer["state"]))) findings.push(error("status.state", `status is ${JSON.stringify(answer["state"])}, not ready, needs_sign_in or error`, { path: "fixtures/conformance.json" }));
  if (!Array.isArray(answer["unguardedAgents"]) || answer["unguardedAgents"].some((agent) => typeof agent !== "string" || agent.length === 0 || agent.length > 64)) {
    findings.push(error("status.shape", "status.unguardedAgents must be a list of agent names", { path: "fixtures/conformance.json" }));
  }
  if (answer["nextStep"] !== null && answer["nextStep"] !== void 0 && (typeof answer["nextStep"] !== "string" || answer["nextStep"].length > 200)) {
    findings.push(error("status.shape", "status.nextStep must be one line of at most 200 characters, or null", { path: "fixtures/conformance.json" }));
  }
  const leading = typeof answer["nextStep"] === "string" ? /^([A-Z][A-Z0-9_]+):/.exec(answer["nextStep"])?.[1] : void 0;
  if (leading !== void 0 && !ERROR_CODES.includes(leading) && !Object.hasOwn(manifest.errors ?? {}, leading)) {
    findings.push(error("status.code", `status.nextStep starts with ${leading}, which is neither in the contract's error table nor declared in capabilities.errors`, { path: "capabilities.errors", fix: `Declare ${leading} in capabilities.errors with surface "status" and its meaning, or use a code from the contract's table.` }));
  }
  const host = answer["host"];
  if (!plain2(host)) findings.push(error("status.host", "status.host must be { version, range, tested }", { path: "fixtures/conformance.json" }));
  else {
    for (const key of Object.keys(host)) if (!HOST_KEYS.includes(key)) findings.push(error("status.host", `status.host carries ${key}, which contract \xA711 does not define`, { path: "fixtures/conformance.json" }));
    if (typeof host["version"] !== "string" || host["version"].length === 0) findings.push(error("status.host", "status.host.version must name the OpenCode release it ran on", { path: "fixtures/conformance.json" }));
    if (host["range"] !== OPENCODE_RANGE) findings.push(error("status.host", `status.host.range is ${JSON.stringify(host["range"])}, and the manifest's is ${OPENCODE_RANGE}`, { path: "fixtures/conformance.json" }));
    if (!Array.isArray(host["tested"]) || host["tested"].length === 0 || host["tested"].some((tested) => typeof tested !== "string")) findings.push(error("status.host", "status.host.tested must list the releases CI ran", { path: "fixtures/conformance.json" }));
  }
  const accounts = answer["accounts"];
  if (!Array.isArray(accounts)) findings.push(error("status.accounts", "status.accounts must be a list, one entry per alias", { path: "fixtures/conformance.json" }));
  else {
    const seen = /* @__PURE__ */ new Set();
    for (const [index, entry] of accounts.entries()) {
      if (!plain2(entry)) {
        findings.push(error("status.accounts", `status.accounts[${index}] must be { alias, state, owner?, reason? }`, { path: "fixtures/conformance.json" }));
        continue;
      }
      for (const key of Object.keys(entry)) if (!ACCOUNT_KEYS.includes(key)) findings.push(error("status.accounts", `status.accounts[${index}] carries ${key}, which contract \xA711 does not define`, { path: "fixtures/conformance.json" }));
      const alias = entry["alias"];
      if (typeof alias !== "string" || !(aliases.length === 0 || aliases.includes(alias))) findings.push(error("status.accounts", `status.accounts[${index}] names ${JSON.stringify(alias)}, which the fixture does not record as an alias`, { path: "fixtures/conformance.json" }));
      else if (seen.has(alias)) findings.push(error("status.accounts", `status lists ${alias} twice`, { path: "fixtures/conformance.json" }));
      else seen.add(alias);
      if (!ACCOUNT_STATES.includes(entry["state"])) findings.push(error("status.accounts", `status.accounts[${index}].state is ${JSON.stringify(entry["state"])}, not ${ACCOUNT_STATES.join(", ")}`, { path: "fixtures/conformance.json" }));
      if (entry["reason"] !== void 0 && (typeof entry["reason"] !== "string" || entry["reason"].length > REASON_MAX)) {
        findings.push(error("status.accounts", `status.accounts[${index}].reason must be one string of at most ${REASON_MAX} characters`, { path: "fixtures/conformance.json" }));
      }
      if (entry["owner"] !== void 0) findings.push(...ownerProblems(entry["owner"], `status.accounts[${index}].owner`).map((problem) => error("status.accounts", problem, { path: "fixtures/conformance.json" })));
    }
    for (const alias of aliases) if (!seen.has(alias)) findings.push(error("status.accounts", `status lists no account ${alias}, and the fixture records it`, { path: "fixtures/conformance.json" }));
  }
  const secrets = secretKinds(JSON.stringify(answer));
  if (secrets.length > 0) findings.push(error("status.secret", `status carries a secret (${secrets.join(", ")}): status and logs never carry credentials`, { path: "fixtures/conformance.json" }));
  return findings;
}

// src/internal/events-conformance.ts
function pageSourceName(source) {
  const named = source.input?.["source"];
  return typeof named === "string" ? named : source.id;
}
var plain3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var codesOf = (expect) => {
  if (typeof expect === "string" && !["page", "empty", "expired"].includes(expect)) return expect;
  if (plain3(expect) && typeof expect["refuses"] === "string") return expect["refuses"].split(":", 1)[0] ?? void 0;
  return void 0;
};
function refusalFindings(item, where) {
  const findings = [];
  const message = item.refuses;
  if (typeof message !== "string") return findings;
  const code = codesOf(item.expect) ?? (item.expect === "expired" ? "CURSOR_EXPIRED" : void 0);
  if (code !== void 0 && !message.startsWith(`${code}: `)) findings.push(error("pages.refusal", `${where} refuses with "${message.slice(0, 120)}", and its case expects ${code}`, { path: "fixtures/conformance.json" }));
  if (!message.includes("Next step: ")) findings.push(error("pages.refusal", `${where}'s refusal has no "Next step: ", and every failure reads CODE: What happened. Next step: What to do.`, { path: "fixtures/conformance.json" }));
  return findings;
}
function eventsFindings(options) {
  const { plugin, source, recorded } = options;
  const cases = recorded.cases ?? [];
  const findings = [];
  if (cases.length === 0) {
    findings.push(
      options.record === true ? warning("pages.recorded", `${source.id} has no recorded page, and the fixture is being recorded`, { path: "fixtures/conformance.json" }) : error("pages.recorded", `${source.id} records no page, so nothing shows what its read answers`, {
        path: "fixtures/conformance.json",
        fix: "Record at least one page from a real account with plugin-kit record."
      })
    );
    return findings;
  }
  const hashes = /* @__PURE__ */ new Map();
  let sawThumbnail = false;
  for (const [index, item] of cases.entries()) {
    const where = `events_list(${item.name ?? `case ${index + 1}`})`;
    const refusal = codesOf(item.expect);
    findings.push(...refusalFindings(item, where));
    if (item.answer === void 0) {
      if (refusal === void 0 && item.expect !== "expired") findings.push(error("pages.answer", `${where} records no answer and no refusal code`, { path: "fixtures/conformance.json" }));
      if (item.expect === "expired" && item.refuses === void 0) findings.push(error("pages.answer", `${where} is an expired-cursor case with neither a gap nor a CURSOR_EXPIRED refusal`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (refusal !== void 0) {
      findings.push(error("pages.answer", `${where} expects the refusal ${refusal} and records an answer`, { path: "fixtures/conformance.json" }));
      continue;
    }
    const answer = item.answer;
    const input = item.input ?? {};
    const asked = input["thumbnails"] === true;
    if (asked && source.thumbnails !== true) {
      findings.push(error("pages.thumbnail", `${where} asks for thumbnails, and ${source.id} does not declare thumbnails`, { path: `capabilities.sources.${source.id}.thumbnails`, fix: "Declare thumbnails: true and urlHosts, or stop asking." }));
    }
    if (!asked && source.thumbnails === true) {
      for (const event of eventsOf(answer)) {
        if (event["thumbnail"] !== void 0) findings.push(error("pages.thumbnail", `${where} answers a thumbnail although the read did not ask for one`, { path: "fixtures/conformance.json" }));
      }
    }
    const account = plain3(answer) && typeof answer["account"] === "string" ? answer["account"] : "default";
    const limit = typeof input["limit"] === "number" && Number.isInteger(input["limit"]) ? input["limit"] : PAGE.max;
    const accepted = acceptAnswer(source, account, answer, { limit, ...asked ? { thumbnails: true } : {} });
    if (!accepted.ok) {
      findings.push(error("pages.shape", `${where}: ${accepted.failure.message}`, { path: "fixtures/conformance.json", fix: "Fix the page the method answers, then record it again." }));
      continue;
    }
    if (!plain3(answer)) continue;
    const page = answer;
    const requestedAccount = typeof input["account"] === "string" ? input["account"] : void 0;
    if (requestedAccount !== void 0 && page.account !== requestedAccount) findings.push(error("pages.account", `${where} was read for ${requestedAccount} and names ${page.account}`, { path: "fixtures/conformance.json" }));
    if (page.plugin !== void 0 && page.plugin !== plugin) findings.push(error("pages.plugin", `${where} names the plugin ${page.plugin}, not ${plugin}`, { path: "fixtures/conformance.json" }));
    if (typeof source.input?.["source"] === "string" && page.source !== pageSourceName(source)) {
      findings.push(error("pages.source", `${where} names the source ${page.source}, not ${pageSourceName(source)}`, { path: `capabilities.sources.${source.id}.input` }));
    }
    if (item.expect === "empty" && page.events.length > 0) findings.push(error("pages.answer", `${where} expects an empty page and lists ${page.events.length} events`, { path: "fixtures/conformance.json" }));
    if (item.expect === "expired" && page.gap?.reason !== "expired") findings.push(error("pages.gap", `${where} expects an expired cursor and answers no gap.reason "expired"`, { path: "fixtures/conformance.json" }));
    if (page.gap !== void 0) findings.push(...gapFindings(source, item, page, cases));
    if (Array.isArray(page.failed) && page.failed.length > 0) {
      const held = typeof input["cursor"] === "string" ? input["cursor"] : "";
      if (page.cursor !== held) findings.push(error("pages.cursor", `${where} carries failed[] and answers another cursor than the one it was read with`, { path: "fixtures/conformance.json", fix: "A failed entry holds the consumer's cursor back." }));
    }
    if (Array.isArray(page.refused)) {
      for (const [at, entry] of page.refused.entries()) {
        if (plain3(entry) && !REFUSAL_REASONS.includes(entry["reason"])) findings.push(error("pages.refused", `${where} refused[${at}] names no reason of ${REFUSAL_REASONS.join(", ")}`, { path: "fixtures/conformance.json" }));
      }
    }
    findings.push(...removalProblems(page).map((problem) => error("pages.removals", `${where}: ${problem}`, { path: "fixtures/conformance.json" })));
    if (source.cost.class === "billed" && page.cost === void 0) findings.push(error("pages.cost", `${where} carries no cost, and ${source.id} is a billed source`, { path: "fixtures/conformance.json" }));
    for (const [at, event] of page.events.entries()) {
      if (typeof event.kind === "string" && !isEventKindIn(event.kind, sourceNamespace(source.id))) {
        findings.push(error("pages.kinds", `${where} events[${at}] is a ${event.kind}, outside the namespace ${sourceNamespace(source.id)}`, { path: `capabilities.sources.${source.id}.reads` }));
      }
      const kinds = secretKinds([event.title, event.text].filter(Boolean).join("\n"));
      if (kinds.length > 0) findings.push(error("pages.secrets", `${where} events[${at}] holds a secret (${kinds.join(", ")}): it belongs in refused[] with reason "secret"`, { path: "fixtures/conformance.json" }));
      const before = hashes.get(`${event.account}\0${event.external_id}`);
      if (before !== void 0 && before !== event.hash) findings.push(error("pages.hash", `${where} lists ${event.external_id} with another hash than an earlier page`, { path: "fixtures/conformance.json" }));
      else hashes.set(`${event.account}\0${event.external_id}`, event.hash);
      if (event.thumbnail !== void 0) {
        sawThumbnail = true;
        findings.push(...thumbnailFindings(where, event, source));
      }
    }
  }
  if (source.thumbnails === true && !sawThumbnail) {
    findings.push(warning("pages.thumbnail", `${source.id} declares thumbnails, and no recorded page carries one`, { path: "fixtures/conformance.json", fix: "Record one page with thumbnails: true, or stop declaring them." }));
  }
  return findings;
}
function gapFindings(source, item, page, cases) {
  const findings = [];
  if (page.gap !== void 0 && !GAP_REASONS.includes(page.gap.reason)) {
    findings.push(error("pages.gap", `events_list(${item.name ?? "a case"}) carries a gap reason outside ${GAP_REASONS.join(", ")}`, { path: "fixtures/conformance.json" }));
  }
  if (page.gap === void 0 || page.more !== true) return findings;
  const next = cases.find((entry) => plain3(entry.input) && entry.input["cursor"] === page.cursor);
  if (next === void 0) {
    findings.push(warning("pages.gap", `events_list(${item.name ?? "a case"}) carries a gap and more: true, and the page its cursor names is not recorded, so the gap is not shown answered once`, { path: "fixtures/conformance.json" }));
    return findings;
  }
  if (plain3(next.answer) && next.answer["gap"] !== void 0) findings.push(error("pages.gap", `events_list(${item.name ?? "a case"}) answers a gap, and the page its cursor names answers another`, { path: "fixtures/conformance.json", fix: "A consumer counts one resync per gap." }));
  return findings;
}
function thumbnailFindings(where, event, source) {
  const findings = [];
  for (const problem of thumbnailUrlProblems(event.thumbnail, source.urlHosts ?? [])) {
    findings.push(error("pages.thumbnail", `${where} ${event.external_id}'s thumbnail ${problem}`, { path: "fixtures/conformance.json" }));
  }
  if (typeof event.thumbnail === "string") {
    const unsafe = thumbnailHostProblem(event.thumbnail);
    if (unsafe !== null) findings.push(error("pages.thumbnail", `${where} ${event.external_id}'s thumbnail host ${unsafe}: a thumbnail is displayed only from a site the source can claim`, { path: "fixtures/conformance.json" }));
  }
  const { hash, ...rest } = event;
  if (eventHash({ ...rest, thumbnail: "https://example.invalid/another.png" }) !== hash) {
    findings.push(error("pages.thumbnail", `${where} ${event.external_id}'s hash changes with its thumbnail: a thumbnail is outside the hash`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}
var eventsOf = (answer) => plain3(answer) && Array.isArray(answer["events"]) ? answer["events"].filter(plain3) : [];
function probeFindings(source, answer, account) {
  if (!plain3(answer)) return [error("probe.shape", `probe(${source.id}) records no answer`, { path: "fixtures/conformance.json" })];
  const findings = [];
  const keys = ["source", "account", "owner", "scopes", "cost", "trust"];
  for (const key of Object.keys(answer)) if (!keys.includes(key)) findings.push(error("probe.shape", `probe(${source.id}) carries ${key}: a probe reads the account, never content`, { path: "fixtures/conformance.json" }));
  if (answer["source"] !== void 0 && typeof source.input?.["source"] === "string" && answer["source"] !== pageSourceName(source)) findings.push(error("probe.shape", `probe(${source.id}) names the source ${String(answer["source"])}, not ${pageSourceName(source)}`, { path: "fixtures/conformance.json" }));
  if (typeof answer["account"] !== "string" || answer["account"].length === 0) findings.push(error("probe.shape", `probe(${source.id}) names no account`, { path: "fixtures/conformance.json" }));
  else if (account !== void 0 && answer["account"] !== account) findings.push(error("probe.shape", `probe(${source.id}) names ${answer["account"]}, not the account it was asked about`, { path: "fixtures/conformance.json" }));
  findings.push(...ownerProblems(answer["owner"], `probe(${source.id}).owner`).map((problem) => error("probe.shape", problem, { path: "fixtures/conformance.json" })));
  if (plain3(answer["owner"]) && typeof answer["owner"]["id"] === "string" && !/^[a-z][a-z0-9+.-]*:/.test(answer["owner"]["id"])) {
    findings.push(error("probe.shape", `probe(${source.id}).owner.id must be scheme-qualified, such as mailto:someone@example.com or slack:U0123`, { path: "fixtures/conformance.json" }));
  }
  if (answer["owner"] === null) findings.push(error("probe.shape", `probe(${source.id}) answers owner: null: an account that is not signed in refuses with NEEDS_SIGN_IN`, { path: "fixtures/conformance.json" }));
  if (answer["trust"] !== "untrusted") findings.push(error("probe.shape", `probe(${source.id}).trust must be "untrusted"`, { path: "fixtures/conformance.json" }));
  return findings;
}
function detailFindings(source, recorded, account) {
  const findings = [];
  for (const item of recorded) {
    const detail = source.details?.find((entry) => entry.id === item.id);
    if (detail === void 0) {
      findings.push(error("details.declared", `the fixture records the detail ${item.id}, which ${source.id} does not declare`, { path: "fixtures/conformance.json" }));
      continue;
    }
    const expected = codesOf(item.expect);
    if (item.refuses !== void 0) {
      const code = expected ?? "PERMISSION_DENIED";
      if (!item.refuses.startsWith(`${code}: `)) findings.push(error("details.refusal", `details(${item.id}) refuses with "${item.refuses.slice(0, 120)}", and its case expects ${code}`, { path: "fixtures/conformance.json" }));
      if (!item.refuses.includes("Next step: ")) findings.push(error("details.refusal", `details(${item.id})'s refusal has no "Next step: "`, { path: "fixtures/conformance.json" }));
    }
    if (item.answer === void 0) {
      if (expected === void 0) findings.push(error("details.answer", `details(${item.id}) records no answer and no refusal code`, { path: "fixtures/conformance.json" }));
      else if (item.refuses === void 0) findings.push(error("details.answer", `details(${item.id}) expects the refusal ${expected} and records no message`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (expected !== void 0) {
      findings.push(error("details.answer", `details(${item.id}) expects the refusal ${expected} and records an answer`, { path: "fixtures/conformance.json" }));
      continue;
    }
    findings.push(...detailInputFindings(detail, item));
    const answerAccount = plain3(item.answer) && typeof item.answer["account"] === "string" ? item.answer["account"] : account;
    const accepted = acceptAnswer(source, answerAccount, item.answer);
    if (!accepted.ok) findings.push(error("details.shape", `details(${item.id}): ${accepted.failure.message}`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}
function detailInputFindings(detail, item) {
  const findings = [];
  const event = item.event ?? {};
  for (const field2 of Object.keys(event)) {
    if (detail.from.includes(field2)) continue;
    findings.push(error("details.input", `details(${detail.id}) records the event field ${field2}, which its from does not name`, { path: "fixtures/conformance.json" }));
  }
  if (event["title"] !== void 0 || event["text"] !== void 0) findings.push(error("details.input", `details(${detail.id}) records an event's title or text, and a detail's input comes only from identifiers`, { path: "fixtures/conformance.json" }));
  for (const field2 of detail.from) {
    if (event[field2] === void 0) findings.push(error("details.input", `details(${detail.id}) records no ${field2}, and the declared input needs it`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}
function suggestFindings(source, answer) {
  const where = `scope.suggest(${source.scope?.suggest?.method ?? "\u2014"})`;
  if (!plain3(answer)) return [error("suggest.answer", `${where} records no answer`, { path: "fixtures/conformance.json" })];
  const options = answer["options"];
  if (!Array.isArray(options)) return [error("suggest.answer", `${where} options must be a list, empty when there is nothing to offer`, { path: "fixtures/conformance.json" })];
  const findings = [];
  if (options.length > 64) findings.push(error("suggest.answer", `${where} offers ${options.length} options, over 64`, { path: "fixtures/conformance.json" }));
  const ids = /* @__PURE__ */ new Set();
  for (const [index, option] of options.entries()) {
    if (!plain3(option) || typeof option["id"] !== "string" || option["id"].length === 0 || option["id"].length > 200) {
      findings.push(error("suggest.answer", `${where} options[${index}] must be { id, label? }`, { path: "fixtures/conformance.json" }));
      continue;
    }
    if (ids.has(option["id"])) findings.push(error("suggest.answer", `${where} offers ${option["id"]} twice`, { path: "fixtures/conformance.json" }));
    ids.add(option["id"]);
    if (option["label"] !== void 0 && (typeof option["label"] !== "string" || option["label"].length > 200)) findings.push(error("suggest.answer", `${where} options[${index}].label must be at most 200 characters`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}
function snapshotFindings(source, answer, account) {
  const findings = [];
  const accepted = acceptAnswer(source, account, answer);
  if (!accepted.ok) findings.push(error("snapshot.shape", `snapshot(${source.id}): ${accepted.failure.message}`, { path: "fixtures/conformance.json" }));
  if (plain3(answer)) {
    if (typeof answer["asOf"] !== "string" || !Number.isFinite(Date.parse(answer["asOf"]))) findings.push(error("snapshot.shape", `snapshot(${source.id}) has no asOf time`, { path: "fixtures/conformance.json" }));
    const checked = checkOutput(source.output, answer["data"]);
    if (!checked.ok) findings.push(...checked.problems.map((problem) => error("snapshot.shape", `snapshot(${source.id}) data: ${problem}`, { path: "fixtures/conformance.json" })));
  }
  if (source.maxBytes !== void 0 && answer !== void 0) {
    const bytes = Buffer.byteLength(JSON.stringify(answer));
    if (bytes > maxBytesOf(source)) findings.push(error("snapshot.shape", `snapshot(${source.id}) is ${bytes} bytes, over its maxBytes of ${maxBytesOf(source)}`, { path: "fixtures/conformance.json" }));
  }
  return findings;
}

// src/conformance.ts
async function t0(pluginDir) {
  const directory = resolve(pluginDir);
  const installed = readInstalledManifest(directory);
  if (!installed.ok) return installed.problems.map((problem) => error("T0.manifest", problem, { path: "package.json", fix: "Fix capabilities in package.json, then run T0 again." }));
  const namespace = readFixture(directory).fixture?.namespace;
  return staticFindings(directory, installed.value.manifest, { ...namespace === void 0 ? {} : { namespace } });
}
async function t1(pluginDir, host) {
  const directory = resolve(pluginDir);
  const installed = readInstalledManifest(directory);
  if (!installed.ok) return installed.problems.map((problem) => error("T1.manifest", problem, { path: "package.json", fix: "Fix capabilities in package.json, then run T1 again." }));
  const read = readFixture(directory).fixture;
  return hostFindings(directory, installed.value.manifest, host, {
    ...read?.accounts?.aliases === void 0 ? {} : { accounts: read.accounts.aliases },
    ...read?.accounts?.real === true ? { realAccounts: true } : {},
    ...typeof read?.accounts?.required?.method === "string" ? { accountMethod: read.accounts.required.method } : {},
    ...read?.accounts?.cursors?.[0] === void 0 ? {} : { accountCursor: read.accounts.cursors[0] },
    ...read?.rpc?.inputs === void 0 ? {} : { inputs: read.rpc.inputs }
  });
}
async function runConformance(pluginDir, options = {}) {
  const directory = resolve(pluginDir);
  const installed = readInstalledManifest(directory);
  if (!installed.ok) {
    return { ok: false, findings: installed.problems.map((problem) => error("manifest.invalid", problem, { path: "package.json", fix: "Fix capabilities in package.json." })) };
  }
  const { manifest, package: packageName, version } = installed.value;
  const findings = [];
  const checks = /* @__PURE__ */ new Set();
  const record = options.record === true;
  findings.push(...declarationFindings(installed.value));
  findings.push(...optionsFindings(manifest));
  const read = readFixture(directory);
  const fixture = read.fixture;
  if (read.problem !== void 0) {
    findings.push(error("fixture.read", read.problem, { path: "fixtures/conformance.json", fix: "Fix the JSON, then run conformance again." }));
  } else if (fixture?.plugin !== void 0 && fixture.plugin !== packageName) {
    findings.push(error("fixture.plugin", `the fixture was recorded for ${fixture.plugin}, not ${packageName}`, { path: "fixtures/conformance.json" }));
  }
  const aliases = fixture?.accounts?.aliases ?? [];
  const account = aliases[0] ?? "default";
  for (const source of manifest.sources) {
    const recorded = fixture?.sources?.[source.id];
    if (recorded === void 0) {
      findings.push(
        record ? warning("sources.recorded", `${source.id} records no answer yet`, { path: "fixtures/conformance.json" }) : error("sources.recorded", `${source.id} records no answer, so nothing shows what its read returns`, {
          path: "fixtures/conformance.json",
          fix: "Record it with plugin-kit record."
        })
      );
      continue;
    }
    if (source.kind === "events") {
      findings.push(...eventsFindings({ plugin: packageName, source, recorded, record }));
      if (source.details !== void 0 && source.details.length > 0) {
        if (recorded.details === void 0 || recorded.details.length === 0) {
          findings.push(record ? warning("details.recorded", `${source.id} declares detail reads and records none`, { path: "fixtures/conformance.json" }) : error("details.recorded", `${source.id} declares detail reads and records none`, { path: "fixtures/conformance.json", fix: "Record one read inside the scope, and one outside it." }));
        } else {
          findings.push(...detailFindings(source, recorded.details, account));
        }
      }
      if (source.scope?.suggest !== void 0) {
        if (recorded.suggest?.answer === void 0) {
          findings.push(record ? warning("suggest.recorded", `${source.id} declares a suggest read and records no answer`, { path: "fixtures/conformance.json" }) : error("suggest.recorded", `${source.id} declares a suggest read and records no answer`, { path: "fixtures/conformance.json" }));
        } else {
          findings.push(...suggestFindings(source, recorded.suggest.answer));
        }
      }
    } else {
      if (recorded.snapshot?.answer === void 0) {
        findings.push(record ? warning("snapshot.recorded", `${source.id} records no snapshot answer`, { path: "fixtures/conformance.json" }) : error("snapshot.recorded", `${source.id} records no snapshot answer`, { path: "fixtures/conformance.json", fix: "Record one snapshot with plugin-kit record." }));
      } else {
        findings.push(...snapshotFindings(source, recorded.snapshot.answer, account));
      }
    }
    if (recorded.probe?.answer !== void 0) findings.push(...probeFindings(source, recorded.probe.answer, void 0));
  }
  if (manifest.accounts !== void 0) {
    const missing = manifest.sources.filter((source) => fixture?.sources?.[source.id]?.probe?.answer === void 0);
    if (missing.length > 0) {
      findings.push(
        record ? warning("probe.recorded", `${missing.map((source) => source.id).join(", ")} record no probe answer`, { path: "fixtures/conformance.json" }) : error("probe.recorded", `${missing.map((source) => source.id).join(", ")} record no probe answer, and a plugin with accounts declares probe`, {
          path: "fixtures/conformance.json",
          fix: "Record probe for each account alias."
        })
      );
    }
  }
  findings.push(...accountFindings(manifest, fixture?.accounts, { record }));
  findings.push(...busFindings(manifest, fixture?.events, { record }));
  if (fixture?.events?.status === void 0) {
    findings.push(record ? warning("status.recorded", `${packageName} records no status answer`, { path: "fixtures/conformance.json" }) : error("status.recorded", `${packageName} records no status answer`, { path: "fixtures/conformance.json", fix: "Record status from one account." }));
  } else {
    findings.push(...statusFindings(manifest, version, fixture.events.status, aliases));
  }
  findings.push(...actionFindings(manifest, fixture?.actions, { record }));
  findings.push(...await grantFindings(manifest, fixture?.grants, { record }));
  findings.push(...rpcConfirmationFindings(manifest, fixture?.rpc, { record }));
  const hosts = options.hosts ?? manifest.plugin.host.tested;
  if (hosts.length === 0) {
    findings.push(warning("T1.unchecked", "no host was run, so the doors, permissions and LD-5 were not proven", { fix: 'Pass hosts: ["2.4.1"], or run plugin-kit hosts.' }));
  }
  let namespace;
  for (const host of hosts) {
    const inspection = await inspectHost(directory, manifest, host, {
      ...aliases.length === 0 ? {} : { accounts: aliases },
      ...fixture?.accounts?.real === true ? { realAccounts: true } : {},
      ...typeof fixture?.accounts?.required?.method === "string" ? { accountMethod: fixture.accounts.required.method } : {},
      ...fixture?.accounts?.cursors?.[0] === void 0 ? {} : { accountCursor: fixture.accounts.cursors[0] },
      ...fixture?.rpc?.inputs === void 0 ? {} : { inputs: fixture.rpc.inputs }
    });
    findings.push(...inspection.findings);
    for (const check of inspection.checks ?? []) checks.add(check);
    if (namespace === void 0 && inspection.run?.namespace !== void 0) namespace = inspection.run.namespace.description;
  }
  if (hosts.length > 0 && !hosts.includes(UNSUPPORTED_HOST)) findings.push(...await hostFindings(directory, manifest, UNSUPPORTED_HOST, aliases.length === 0 ? {} : { accounts: aliases }));
  const recordedNamespace = namespace ?? fixture?.namespace;
  findings.unshift(...staticFindings(directory, manifest, { ...recordedNamespace === void 0 ? {} : { namespace: recordedNamespace }, record }));
  return { ok: isOk(findings), findings, ...checks.size === 0 ? {} : { checks: [...checks] } };
}

export {
  waitForActivation,
  createCodeMode,
  connectMcpServer,
  mcpAddress,
  createAutomation,
  automationApi,
  TurnLog,
  createHost,
  DOC_FILES,
  renderGeneratedDocs,
  docsFindings,
  t0,
  t1,
  runConformance
};
