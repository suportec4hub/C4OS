import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { L } from "../constants/theme";
import { useTable } from "../hooks/useData";
import { Fade, Row, Grid, TabPills, PBtn, DataTable, Tag, IBtn, TD, Card, TT } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const CANAIS = ["Google Ads","Meta Ads","Instagram Orgânico","LinkedIn","TikTok Ads","YouTube Ads","Email Marketing","WhatsApp","SEO / Blog","Referral","Outro"];
const OBJETIVOS = ["Geração de Leads","Brand Awareness","Conversão","Retenção","Engajamento","Tráfego para Site"];
const TIPOS_CONTEUDO = ["post","story","reels","email","blog","ads","video","outro"];
const TIPO_LABEL = { post:"Post Feed",story:"Story",reels:"Reels/Short",email:"E-mail",blog:"Blog/Artigo",ads:"Anúncio",video:"Vídeo",outro:"Outro" };
const STATUS_C = { ativa:L.green, pausada:L.yellow, concluida:L.teal, rascunho:L.t4 };
const STATUS_BG= { ativa:L.greenBg, pausada:L.yellowBg, concluida:L.tealBg, rascunho:L.surface };
const CONT_C   = { ideia:L.t4, em_producao:L.yellow, aprovado:L.teal, publicado:L.green, arquivado:L.t5 };
const CONT_BG  = { ideia:L.surface, em_producao:L.yellowBg, aprovado:L.tealBg, publicado:L.greenBg, arquivado:L.surface };

const VAZIO_CAMP = { nome:"", canal:"Google Ads", objetivo:"Geração de Leads", budget:"", gasto:"", leads_gerados:"0", conversoes:"0", status:"ativa", data_inicio:"", data_fim:"", publico_alvo:"", utm_source:"", utm_medium:"", utm_campaign:"", observacao:"" };
const VAZIO_CONT = { titulo:"", tipo:"post", canal:"Instagram", status:"ideia", data_publicacao:"", observacao:"" };

const fmt = (v) => `R$ ${parseFloat(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const pct = (a,b) => b > 0 ? ((a/b)*100).toFixed(1)+"%" : "—";
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function PageMarketing({ user }) {
  const { data:campanhas, loading:loadC, insert:insC, update:updC, remove:remC, refetch:refC } = useTable("marketing_campanhas",  { empresa_id:user?.empresa_id });
  const { data:conteudos, loading:loadCo, insert:insCo, update:updCo, remove:remCo, refetch:refCo } = useTable("marketing_conteudos", { empresa_id:user?.empresa_id });

  const [aba,    setAba]    = useState("Campanhas");
  const [modal,  setModal]  = useState(false); // "campanha" | "conteudo" | false
  const [edit,   setEdit]   = useState(null);
  const [form,   setForm]   = useState(VAZIO_CAMP);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const F = k => v => setForm(p=>({...p,[k]:v}));

  // KPIs
  const ativas      = campanhas.filter(c=>c.status==="ativa").length;
  const budgetTotal = campanhas.reduce((s,c)=>s+parseFloat(c.budget||0),0);
  const gastoTotal  = campanhas.reduce((s,c)=>s+parseFloat(c.gasto||0),0);
  const leadsTotal  = campanhas.reduce((s,c)=>s+parseInt(c.leads_gerados||0),0);
  const convTotal   = campanhas.reduce((s,c)=>s+parseInt(c.conversoes||0),0);
  const cpl         = leadsTotal > 0 ? gastoTotal/leadsTotal : 0;
  const roi         = gastoTotal > 0 ? ((convTotal/leadsTotal||0)*100) : 0;

  // Chart por canal
  const canalData = useMemo(()=>{
    const map = {};
    campanhas.forEach(c=>{ map[c.canal] = (map[c.canal]||0)+parseInt(c.leads_gerados||0); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,leads])=>({name:name.split(" ")[0],leads}));
  }, [campanhas]);

  // Conteúdo por status
  const contStatusData = useMemo(()=>{
    const map = {};
    conteudos.forEach(c=>{ map[c.status] = (map[c.status]||0)+1; });
    return Object.entries(map).map(([name,value])=>({name:name.replace("_"," "),value,rawStatus:name}));
  }, [conteudos]);
  const PIE_COLORS = [L.t4,L.yellow,L.teal,L.green,L.surface];

  const openCampanha = (c=null) => {
    setForm(c ? {...c,budget:String(c.budget),gasto:String(c.gasto),leads_gerados:String(c.leads_gerados),conversoes:String(c.conversoes)} : VAZIO_CAMP);
    setEdit(c?.id||null); setErr(""); setModal("campanha");
  };
  const openConteudo = (c=null) => {
    setForm(c ? {...c} : VAZIO_CONT);
    setEdit(c?.id||null); setErr(""); setModal("conteudo");
  };

  const saveCampanha = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, budget:parseFloat(form.budget||0), gasto:parseFloat(form.gasto||0), leads_gerados:parseInt(form.leads_gerados||0), conversoes:parseInt(form.conversoes||0), empresa_id:user?.empresa_id };
    const {error} = edit ? await updC(edit,payload) : await insC(payload);
    if (error) setErr(error.message);
    else { setModal(false); refC(); }
    setSaving(false);
  };

  const saveConteudo = async () => {
    if (!form.titulo.trim()) { setErr("Título é obrigatório."); return; }
    setSaving(true); setErr("");
    const payload = { ...form, empresa_id:user?.empresa_id };
    const {error} = edit ? await updCo(edit,payload) : await insCo(payload);
    if (error) setErr(error.message);
    else { setModal(false); refCo(); }
    setSaving(false);
  };

  // Calendário editorial: agrupar conteúdos com data_publicacao por dia
  const mes = new Date();
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth()+1, 0).getDate();
  const mesKey = `${mes.getFullYear()}-${String(mes.getMonth()+1).padStart(2,"0")}`;
  const conteudosPorDia = {};
  conteudos.filter(c=>c.data_publicacao?.startsWith(mesKey)).forEach(c=>{
    const dia = parseInt(c.data_publicacao.split("-")[2]);
    if (!conteudosPorDia[dia]) conteudosPorDia[dia] = [];
    conteudosPorDia[dia].push(c);
  });
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();

  return (
    <Fade>
      {/* KPIs */}
      <Grid cols={5} gap={12} mb={16} responsive>
        {[
          {l:"Campanhas Ativas",  v:ativas,       c:L.green},
          {l:"Budget Total",      v:fmt(budgetTotal), c:L.teal},
          {l:"Total Gasto",       v:fmt(gastoTotal),  c:L.red},
          {l:"Leads Gerados",     v:leadsTotal,   c:L.copper},
          {l:"CPL Médio",         v:fmt(cpl),     c:L.yellow},
        ].map((k,i)=>(
          <div key={i} style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,padding:"15px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:9.5,color:L.t4,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:19,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif",lineHeight:1.2}}>{k.v}</div>
          </div>
        ))}
      </Grid>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:12,marginBottom:16}} className="rg-auto">
        <Card title="Leads por Canal" sub="todas as campanhas">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={canalData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} horizontal={false}/>
              <XAxis type="number" tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fill:L.t3,fontSize:11}} axisLine={false} tickLine={false} width={80}/>
              <Tooltip contentStyle={TT}/>
              <Bar dataKey="leads" fill={L.teal} radius={[0,4,4,0]} name="Leads"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Conteúdo por Status" sub="calendário editorial">
          {contStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={contStatusData} cx="50%" cy="50%" outerRadius={55} dataKey="value" paddingAngle={3}>
                  {contStatusData.map((_,i)=><Cell key={i} fill={CONT_C[_.rawStatus]||PIE_COLORS[i%5]}/>)}
                </Pie>
                <Tooltip contentStyle={TT}/>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{fontSize:10,color:L.t3}}/>
              </PieChart>
            </ResponsiveContainer>
          ):<div style={{textAlign:"center",padding:40,color:L.t4,fontSize:11}}>Nenhum conteúdo</div>}
        </Card>
      </div>

      {/* Tabs */}
      <Row between mb={12}>
        <TabPills tabs={["Campanhas","Calendário Editorial"]} active={aba} onChange={setAba}/>
        <PBtn onClick={()=>aba==="Campanhas"?openCampanha():openConteudo()}>
          {aba==="Campanhas"?"+ Campanha":"+ Conteúdo"}
        </PBtn>
      </Row>

      {/* Tab Campanhas */}
      {aba==="Campanhas"&&(
        loadC ? <div style={{textAlign:"center",padding:40,color:L.t4}}>Carregando...</div> : (
          <DataTable heads={["Campanha","Canal","Objetivo","Budget","Leads","Conv.","CPL","Status","Ações"]}>
            {campanhas.map(c=>{
              const cplC = parseInt(c.leads_gerados||0)>0 ? parseFloat(c.gasto||0)/parseInt(c.leads_gerados) : 0;
              return (
                <tr key={c.id} style={{borderBottom:`1px solid ${L.lineSoft}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=L.surface}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{...TD,fontWeight:500,color:L.t1,maxWidth:180}}>
                    <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.nome}</div>
                    {c.data_inicio&&<div style={{fontSize:9.5,color:L.t5,marginTop:1}}>{fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}</div>}
                  </td>
                  <td style={{...TD,fontSize:11,color:L.t3}}>{c.canal}</td>
                  <td style={{...TD,fontSize:11,color:L.t3}}>{c.objetivo}</td>
                  <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
                    <div style={{color:L.teal}}>{fmt(c.budget)}</div>
                    <div style={{color:L.red,fontSize:10}}>gasto: {fmt(c.gasto)}</div>
                  </td>
                  <td style={{...TD,fontWeight:600,color:L.copper,textAlign:"center"}}>{c.leads_gerados||0}</td>
                  <td style={{...TD,fontWeight:600,color:L.green,textAlign:"center"}}>{c.conversoes||0}</td>
                  <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:L.t2}}>{fmt(cplC)}</td>
                  <td style={TD}><Tag color={STATUS_C[c.status]||L.t4} bg={STATUS_BG[c.status]||L.surface}>{c.status}</Tag></td>
                  <td style={TD}>
                    <Row gap={4}>
                      <IBtn c={L.teal} onClick={()=>openCampanha(c)}>✎</IBtn>
                      <IBtn c={L.red}  onClick={()=>{if(confirm("Excluir campanha?"))remC(c.id);}}>⊗</IBtn>
                    </Row>
                  </td>
                </tr>
              );
            })}
            {campanhas.length===0&&<tr><td colSpan={9} style={{...TD,textAlign:"center",color:L.t4,padding:40}}>Nenhuma campanha. Clique em '+ Campanha' para criar.</td></tr>}
          </DataTable>
        )
      )}

      {/* Tab Calendário */}
      {aba==="Calendário Editorial"&&(
        <div style={{background:L.white,borderRadius:12,border:`1px solid ${L.line}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${L.lineSoft}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:13,fontWeight:600,color:L.t1}}>{mes.toLocaleString("pt-BR",{month:"long",year:"numeric"})}</span>
            <span style={{fontSize:11,color:L.t4}}>{conteudos.filter(c=>c.data_publicacao?.startsWith(mesKey)).length} conteúdos este mês</span>
          </div>
          {/* Cabeçalho dias da semana */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${L.lineSoft}`}}>
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=>(
              <div key={d} style={{padding:"8px 0",textAlign:"center",fontSize:10,fontWeight:700,color:L.t4,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1px",textTransform:"uppercase"}}>{d}</div>
            ))}
          </div>
          {/* Grid de dias */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {Array.from({length: primeiroDia}).map((_,i)=>(
              <div key={`empty-${i}`} style={{minHeight:80,borderRight:`1px solid ${L.lineSoft}`,borderBottom:`1px solid ${L.lineSoft}`}}/>
            ))}
            {Array.from({length:diasNoMes},(_,i)=>i+1).map(dia=>{
              const conts = conteudosPorDia[dia]||[];
              const hoje = new Date().getDate();
              const isHoje = dia===hoje && mes.getMonth()===new Date().getMonth();
              return (
                <div key={dia} style={{minHeight:80,borderRight:`1px solid ${L.lineSoft}`,borderBottom:`1px solid ${L.lineSoft}`,padding:6,cursor:"pointer",transition:"background .1s",background:isHoje?L.tealBg:"transparent"}}
                  onClick={()=>{ const d=new Date(mes.getFullYear(),mes.getMonth(),dia); const s=d.toISOString().split("T")[0]; setForm({...VAZIO_CONT,data_publicacao:s}); setEdit(null); setErr(""); setModal("conteudo"); }}
                  onMouseEnter={e=>{ if(!isHoje)e.currentTarget.style.background=L.surface; }}
                  onMouseLeave={e=>{ if(!isHoje)e.currentTarget.style.background="transparent"; }}
                >
                  <div style={{fontSize:11,fontWeight:isHoje?700:400,color:isHoje?L.teal:L.t3,marginBottom:4}}>{dia}</div>
                  {conts.slice(0,3).map(c=>(
                    <div key={c.id} onClick={e=>{e.stopPropagation();openConteudo(c);}}
                      style={{fontSize:9.5,padding:"2px 5px",borderRadius:4,marginBottom:2,background:CONT_C[c.status]||L.t4,color:"white",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer"}}>
                      {c.titulo}
                    </div>
                  ))}
                  {conts.length>3&&<div style={{fontSize:9,color:L.t4}}>+{conts.length-3} mais</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Campanha */}
      {modal==="campanha"&&(
        <Modal title={edit?"Editar Campanha":"Nova Campanha"} onClose={()=>setModal(false)} width={580}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Nome da Campanha *" style={{gridColumn:"1/-1"}}>
              <Input value={form.nome} onChange={F("nome")} placeholder="Ex: Black Friday 2025 — Google Ads"/>
            </Field>
            <Field label="Canal">
              <Select value={form.canal} onChange={F("canal")}>
                {CANAIS.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Objetivo">
              <Select value={form.objetivo} onChange={F("objetivo")}>
                {OBJETIVOS.map(o=><option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={F("status")}>
                {["ativa","pausada","concluida","rascunho"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Público-Alvo">
              <Input value={form.publico_alvo||""} onChange={F("publico_alvo")} placeholder="Ex: Homens 25-40, interesse em tech"/>
            </Field>
            <Field label="Budget (R$)">
              <Input value={form.budget} onChange={F("budget")} type="number" placeholder="0.00"/>
            </Field>
            <Field label="Gasto Atual (R$)">
              <Input value={form.gasto} onChange={F("gasto")} type="number" placeholder="0.00"/>
            </Field>
            <Field label="Leads Gerados">
              <Input value={form.leads_gerados} onChange={F("leads_gerados")} type="number" placeholder="0"/>
            </Field>
            <Field label="Conversões">
              <Input value={form.conversoes} onChange={F("conversoes")} type="number" placeholder="0"/>
            </Field>
            <Field label="Data Início">
              <Input value={form.data_inicio||""} onChange={F("data_inicio")} type="date"/>
            </Field>
            <Field label="Data Fim">
              <Input value={form.data_fim||""} onChange={F("data_fim")} type="date"/>
            </Field>
            <div style={{gridColumn:"1/-1",padding:"10px 0 4px",borderTop:`1px solid ${L.lineSoft}`,marginTop:4}}>
              <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1.5px",fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>UTM Tracking (opcional)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 10px"}}>
                <Field label="utm_source"><Input value={form.utm_source||""} onChange={F("utm_source")} placeholder="google"/></Field>
                <Field label="utm_medium"><Input value={form.utm_medium||""} onChange={F("utm_medium")} placeholder="cpc"/></Field>
                <Field label="utm_campaign"><Input value={form.utm_campaign||""} onChange={F("utm_campaign")} placeholder="campanha-x"/></Field>
              </div>
              {(form.utm_source||form.utm_medium||form.utm_campaign)&&(
                <div style={{padding:"6px 10px",background:L.surface,borderRadius:6,fontSize:10,color:L.t3,fontFamily:"'JetBrains Mono',monospace",marginTop:6,wordBreak:"break-all"}}>
                  ?utm_source={form.utm_source||"..."}&utm_medium={form.utm_medium||"..."}&utm_campaign={form.utm_campaign||"..."}
                </div>
              )}
            </div>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveCampanha} loading={saving} label={edit?"Salvar":"Criar Campanha"}/>
        </Modal>
      )}

      {/* Modal Conteúdo */}
      {modal==="conteudo"&&(
        <Modal title={edit?"Editar Conteúdo":"Novo Conteúdo"} onClose={()=>setModal(false)} width={460}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Título *" style={{gridColumn:"1/-1"}}>
              <Input value={form.titulo||""} onChange={F("titulo")} placeholder="Ex: Post sobre novidades Q1"/>
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo||"post"} onChange={F("tipo")}>
                {TIPOS_CONTEUDO.map(t=><option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={form.canal||"Instagram"} onChange={F("canal")}>
                {["Instagram","LinkedIn","TikTok","YouTube","Twitter/X","Facebook","Blog","Email","WhatsApp"].map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status||"ideia"} onChange={F("status")}>
                {["ideia","em_producao","aprovado","publicado","arquivado"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}
              </Select>
            </Field>
            <Field label="Data Publicação">
              <Input value={form.data_publicacao||""} onChange={F("data_publicacao")} type="date"/>
            </Field>
            <Field label="Link" style={{gridColumn:"1/-1"}}>
              <Input value={form.link||""} onChange={F("link")} placeholder="https://..."/>
            </Field>
            <Field label="Observação" style={{gridColumn:"1/-1"}}>
              <Input value={form.observacao||""} onChange={F("observacao")} placeholder="Briefing, hashtags, notas..."/>
            </Field>
          </div>
          {err&&<div style={{padding:"8px 12px",background:L.redBg,borderRadius:8,fontSize:12,color:L.red,marginTop:4}}>{err}</div>}
          <ModalFooter onClose={()=>setModal(false)} onSave={saveConteudo} loading={saving} label={edit?"Salvar":"Criar Conteúdo"}/>
        </Modal>
      )}
    </Fade>
  );
}
