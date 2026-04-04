import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { L } from "../constants/theme";
import { depsInit, equipeInit } from "../constants/mockData";
import { Fade, Row, Card, Grid, PBtn, IBtn, Tag, TT } from "../components/ui";
import Modal, { Field, Input, Select, ModalFooter } from "../components/Modal";

const ICONS = { "Comercial":"◈", "Pré-vendas":"◎", "Pós-vendas":"⊙", "Marketing":"⊞" };

const kpisDep = {
  "Comercial": {
    kpis: [
      { l:"Leads Ativos",   v:"34",     c:L.teal },
      { l:"Deals Fechados", v:"8",      c:L.green },
      { l:"Ticket Médio",   v:"R$7,6k", c:L.teal },
      { l:"Taxa Conversão", v:"23,5%",  c:L.green },
    ],
    membros: [
      { nome:"Larissa Costa",  cargo:"Gestora",   leads:34, fechados:8,  conv:"23,5%", status:"Ativo" },
      { nome:"Bruno Lima",     cargo:"SDR Sênior",leads:51, fechados:7,  conv:"13,7%", status:"Ativo" },
      { nome:"Ricardo Alves",  cargo:"Closer",    leads:19, fechados:11, conv:"57,9%", status:"Ativo" },
    ],
    trend: [
      { m:"Jan",v:48 },{ m:"Fev",v:52 },{ m:"Mar",v:61 },
      { m:"Abr",v:58 },{ m:"Mai",v:74 },{ m:"Jun",v:89 },
    ],
    atividades: [
      { msg:"Ricardo fechou Indústria Delta — R$78.000",     hora:"14:32", tipo:"sucesso" },
      { msg:"Proposta enviada para MegaCorp Brasil",         hora:"13:15", tipo:"info" },
      { msg:"Follow-up pendente: Carlos Silva / Alfa Ltda",  hora:"12:08", tipo:"alerta" },
      { msg:"Lead qualificado: TechBrasil S.A. — score 74",  hora:"11:00", tipo:"info" },
    ],
  },
  "Pré-vendas": {
    kpis: [
      { l:"Leads Gerados",  v:"89",    c:L.copper },
      { l:"Qualificados",   v:"61",    c:L.green },
      { l:"Taxa Qualif.",   v:"68,5%", c:L.copper },
      { l:"Agendamentos",   v:"22",    c:L.teal },
    ],
    membros: [
      { nome:"Fernanda Cruz",  cargo:"SDR Jr",  leads:28, fechados:3, conv:"10,7%", status:"Ativo" },
      { nome:"Marcos Barbosa", cargo:"SDR",     leads:51, fechados:5, conv:"9,8%",  status:"Ativo" },
    ],
    trend: [
      { m:"Jan",v:55 },{ m:"Fev",v:62 },{ m:"Mar",v:71 },
      { m:"Abr",v:68 },{ m:"Mai",v:79 },{ m:"Jun",v:89 },
    ],
    atividades: [
      { msg:"89 leads qualificados esta semana",             hora:"14:00", tipo:"sucesso" },
      { msg:"22 reuniões agendadas para a próxima semana",   hora:"13:30", tipo:"info" },
      { msg:"Campanha WhatsApp gerou 34 novos leads",        hora:"11:45", tipo:"info" },
      { msg:"Taxa de no-show: 12% (acima da meta de 10%)",   hora:"10:00", tipo:"alerta" },
    ],
  },
  "Pós-vendas": {
    kpis: [
      { l:"NPS Atual",   v:"71",   c:L.green },
      { l:"Churn Rate",  v:"2,1%", c:L.red },
      { l:"Upsells",     v:"4",    c:L.green },
      { l:"Tickets",     v:"18",   c:L.copper },
    ],
    membros: [
      { nome:"Joana Meireles", cargo:"CS Manager", leads:0, fechados:4, conv:"NPS 71", status:"Ativo" },
    ],
    trend: [
      { m:"Jan",v:68 },{ m:"Fev",v:70 },{ m:"Mar",v:69 },
      { m:"Abr",v:72 },{ m:"Mai",v:74 },{ m:"Jun",v:71 },
    ],
    atividades: [
      { msg:"NPS de 71 — 3 pontos acima da meta",          hora:"14:00", tipo:"sucesso" },
      { msg:"Upsell concluído: TechBrasil → Enterprise",   hora:"12:30", tipo:"sucesso" },
      { msg:"Ticket em aberto: Varejo Express — 3 dias",   hora:"11:00", tipo:"alerta" },
      { msg:"Churn detectado: StartupX em risco",          hora:"09:45", tipo:"alerta" },
    ],
  },
  "Marketing": {
    kpis: [
      { l:"Leads Gerados", v:"189",    c:L.blue },
      { l:"Meta",          v:"200",    c:L.t3 },
      { l:"CPL Médio",     v:"R$18",   c:L.blue },
      { l:"ROAS",          v:"4,2x",   c:L.green },
    ],
    membros: [
      { nome:"Ana Lima", cargo:"Marketing Lead", leads:189, fechados:0, conv:"94,5% da meta", status:"Ativo" },
    ],
    trend: [
      { m:"Jan",v:120 },{ m:"Fev",v:145 },{ m:"Mar",v:189 },
      { m:"Abr",v:167 },{ m:"Mai",v:210 },{ m:"Jun",v:189 },
    ],
    atividades: [
      { msg:"189/200 leads captados — 94,5% da meta mensal",     hora:"14:00", tipo:"sucesso" },
      { msg:"Campanha WhatsApp: 15,6% de resposta",              hora:"13:00", tipo:"info" },
      { msg:"Google Ads: ROAS 4,2x esta semana",                 hora:"11:30", tipo:"sucesso" },
      { msg:"Meta Ads com queda de 8% no CTR — revisar criativos",hora:"09:00", tipo:"alerta" },
    ],
  },
};

const TIPO_COR = { sucesso: L.green, info: L.teal, alerta: L.yellow };
const TIPO_BG  = { sucesso: L.greenBg, info: L.tealBg, alerta: L.yellowBg };

const NOVO_VAZIO = { nome:"", descricao:"", meta:"", responsavel:"", cor:L.teal };

export default function PageDeps() {
  const [expanded, setExpanded] = useState(null);
  const [novoModal, setNovoModal] = useState(false);
  const [form, setForm] = useState(NOVO_VAZIO);

  const toggle = (id) => setExpanded(p => p === id ? null : id);
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  return (
    <Fade>
      <Row between mb={14}>
        <span style={{fontSize:12,color:L.t3}}>{depsInit.length} departamentos</span>
        <PBtn onClick={()=>setNovoModal(true)}>+ Novo</PBtn>
      </Row>

      <Grid cols={2} gap={12} mb={14}>
        {depsInit.map((d) => {
          const open  = expanded === d.id;
          const extra = kpisDep[d.nome];

          return (
            <div key={d.id} style={{background:L.white,borderRadius:12,border:`1.5px solid ${open?d.cor+"66":L.line}`,overflow:"hidden",transition:"border-color .2s",boxShadow:open?"0 4px 16px rgba(0,0,0,0.07)":"0 1px 3px rgba(0,0,0,0.04)"}}>

              {/* Header */}
              <div style={{padding:20,cursor:"pointer"}} onClick={()=>toggle(d.id)}>
                <Row between mb={14}>
                  <Row gap={10}>
                    <div style={{width:38,height:38,borderRadius:10,background:d.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:d.cor,fontWeight:700}}>
                      {ICONS[d.nome] || "◈"}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:L.t1}}>{d.nome}</div>
                      <div style={{fontSize:11,color:L.t4}}>{d.membros} membro{d.membros!==1?"s":""}</div>
                    </div>
                  </Row>
                  <Row gap={10}>
                    <span style={{fontSize:13,fontWeight:700,color:d.cor,fontFamily:"'Outfit',sans-serif"}}>{d.pct}%</span>
                    <span style={{fontSize:14,color:open?d.cor:L.t4,transition:"color .2s"}}>{open?"▲":"▼"}</span>
                  </Row>
                </Row>
                <Row between mb={8}>
                  <span style={{fontSize:11,color:L.t4}}>Meta: <b style={{color:L.t2}}>{d.meta}</b></span>
                  <span style={{fontSize:11,color:d.cor,fontWeight:500}}>{d.atual}</span>
                </Row>
                <div style={{height:6,background:L.surface,borderRadius:4,overflow:"hidden",border:`1px solid ${L.line}`}}>
                  <div style={{width:`${d.pct}%`,height:"100%",background:d.cor,borderRadius:4,transition:"width .6s ease"}}/>
                </div>
              </div>

              {/* Expanded detail */}
              {open && extra && (
                <div style={{borderTop:`1px solid ${L.line}`,background:L.surface,padding:20}}>

                  {/* KPIs */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
                    {extra.kpis.map((k,i) => (
                      <div key={i} style={{background:L.white,borderRadius:9,padding:11,border:`1px solid ${L.line}`,textAlign:"center"}}>
                        <div style={{fontSize:17,fontWeight:700,color:k.c,fontFamily:"'Outfit',sans-serif"}}>{k.v}</div>
                        <div style={{fontSize:10,color:L.t4,marginTop:2}}>{k.l}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
                    {/* Membros */}
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:9,fontFamily:"'JetBrains Mono',monospace"}}>Membros</div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {extra.membros.map((m,i) => (
                          <div key={i} style={{background:L.white,borderRadius:8,padding:"9px 12px",border:`1px solid ${L.line}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div>
                              <div style={{fontSize:12,fontWeight:600,color:L.t1}}>{m.nome}</div>
                              <div style={{fontSize:10,color:L.t4}}>{m.cargo}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:11,color:L.teal,fontWeight:600}}>{m.conv}</div>
                              <div style={{fontSize:10,color:L.t4}}>{m.leads} leads</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Trend */}
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:9,fontFamily:"'JetBrains Mono',monospace"}}>Tendência (6 meses)</div>
                      <div style={{background:L.white,borderRadius:8,border:`1px solid ${L.line}`,padding:10}}>
                        <ResponsiveContainer width="100%" height={110}>
                          <LineChart data={extra.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke={L.lineSoft} vertical={false}/>
                            <XAxis dataKey="m" tick={{fill:L.t4,fontSize:9}} axisLine={false} tickLine={false}/>
                            <YAxis hide domain={["auto","auto"]}/>
                            <Tooltip contentStyle={TT}/>
                            <Line type="monotone" dataKey="v" stroke={d.cor} strokeWidth={2} dot={{fill:d.cor,r:3}} activeDot={{r:4}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Atividades recentes */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:L.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:9,fontFamily:"'JetBrains Mono',monospace"}}>Atividades Recentes</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {extra.atividades.map((a,i) => (
                        <div key={i} style={{background:L.white,borderRadius:8,border:`1px solid ${L.line}`,padding:"8px 12px",display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:TIPO_COR[a.tipo],flexShrink:0}}/>
                          <div style={{flex:1,fontSize:11.5,color:L.t2}}>{a.msg}</div>
                          <div style={{fontSize:10,color:L.t4,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>{a.hora}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </Grid>

      {/* Bar chart geral */}
      <Card title="Performance Geral" sub="progresso por departamento">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={depsInit.map(d=>({name:d.nome,pct:d.pct,cor:d.cor}))}>
            <CartesianGrid strokeDasharray="4 4" stroke={L.lineSoft} vertical={false}/>
            <XAxis dataKey="name" tick={{fill:L.t4,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:L.t4,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
            <Tooltip contentStyle={TT} formatter={v=>[`${v}%`,"Progresso"]}/>
            <Bar dataKey="pct" radius={[6,6,0,0]}>
              {depsInit.map((d,i) => <Cell key={i} fill={d.cor}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Modal novo departamento */}
      {novoModal && (
        <Modal title="Novo Departamento" onClose={()=>setNovoModal(false)} width={440}>
          <Field label="Nome do Departamento"><Input value={form.nome} onChange={F("nome")} placeholder="Ex: Customer Success"/></Field>
          <Field label="Descrição"><Input value={form.descricao} onChange={F("descricao")} placeholder="Objetivo do departamento"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Meta"><Input value={form.meta} onChange={F("meta")} placeholder="Ex: R$50.000 ou NPS 80"/></Field>
            <Field label="Responsável"><Input value={form.responsavel} onChange={F("responsavel")} placeholder="Nome do líder"/></Field>
          </div>
          <ModalFooter onClose={()=>setNovoModal(false)} onSave={()=>setNovoModal(false)} label="Criar Departamento"/>
        </Modal>
      )}
    </Fade>
  );
}
