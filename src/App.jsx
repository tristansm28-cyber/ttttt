import { useState, useMemo, useEffect } from "react";

// ─── STORAGE (localStorage — works in any browser) ──────────────────────────
const LS_LEADS     = "landdesk_leads";
const LS_REMINDERS = "landdesk_reminders";
const lsGet = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STAGES = ["Lead","Contacted","Negotiating","Under Contract","Closed","Dead"];
const STAGE_COLORS = {
  "Lead":"#f59e0b","Contacted":"#3b82f6","Negotiating":"#a855f7",
  "Under Contract":"#10b981","Closed":"#22c55e","Dead":"#6b7280"
};
const INITIAL_LEADS = [
  { id:"l1", name:"John Hargrove", phone:"555-201-4433", email:"j.hargrove@email.com", county:"Travis County", state:"TX", acres:42, askingPrice:185000, offerPrice:120000, arv:210000, repairCost:0, stage:"Negotiating", notes:"Owner motivated, inherited land. Prefers cash deal.", date:"2026-02-14", assignedTo:"Me" },
  { id:"l2", name:"Maria Delgado", phone:"555-309-8821", email:"mdelgado@mail.com", county:"Bexar County", state:"TX", acres:18, askingPrice:72000, offerPrice:48000, arv:85000, repairCost:0, stage:"Contacted", notes:"Left voicemail x2. Best time: mornings.", date:"2026-02-28", assignedTo:"Me" },
  { id:"l3", name:"Frank Simmons", phone:"555-447-2210", email:"", county:"Hays County", state:"TX", acres:110, askingPrice:450000, offerPrice:310000, arv:500000, repairCost:0, stage:"Under Contract", notes:"Signed PSA 3/1. Closing set for 3/28.", date:"2026-03-01", assignedTo:"Me" },
  { id:"l4", name:"Linda Chu", phone:"555-512-9034", email:"lchu@webmail.com", county:"Williamson County", state:"TX", acres:6, askingPrice:28000, offerPrice:0, arv:35000, repairCost:0, stage:"Lead", notes:"Direct mail response. Hasn't been contacted yet.", date:"2026-03-08", assignedTo:"Me" },
];
const INITIAL_REMINDERS = [
  { id:"r1", leadId:"l2", leadName:"Maria Delgado", text:"Call back — morning follow-up", dueDate:"2026-03-11", done:false },
  { id:"r2", leadId:"l3", leadName:"Frank Simmons", text:"Closing date 3/28 — confirm title company", dueDate:"2026-03-25", done:false },
];
const EMPTY_LEAD = { name:"",phone:"",email:"",county:"",state:"TX",acres:"",askingPrice:"",offerPrice:"",arv:"",repairCost:"",stage:"Lead",notes:"",assignedTo:"Me" };
const EMPTY_REM  = { text:"", dueDate:"", leadId:"" };

const fmt$ = v => v ? `$${Number(v).toLocaleString()}` : "—";
const fmtAc = v => v ? `${v} ac` : "—";
const todayStr = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [leads,     setLeads]     = useState(() => lsGet(LS_LEADS, INITIAL_LEADS));
  const [reminders, setReminders] = useState(() => lsGet(LS_REMINDERS, INITIAL_REMINDERS));
  const [view,      setView]      = useState("pipeline");
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(EMPTY_LEAD);
  const [editMode,  setEditMode]  = useState(false);
  const [search,    setSearch]    = useState("");
  const [filterStage, setFilterStage] = useState("All");
  const [toast,     setToast]     = useState(null);
  const [remForm,   setRemForm]   = useState(EMPTY_REM);
  const [showRemForm, setShowRemForm] = useState(false);
  const [calc, setCalc] = useState({ arv:0, discount:70, repairs:0, wholesale:15000 });

  // Auto-save
  useEffect(() => { lsSet(LS_LEADS, leads); }, [leads]);
  useEffect(() => { lsSet(LS_REMINDERS, reminders); }, [reminders]);

  const showToast = (msg, type="success") => {
    setToast({msg,type});
    setTimeout(() => setToast(null), 3000);
  };

  const today = todayStr();
  const dueToday = reminders.filter(r => !r.done && r.dueDate === today);
  const overdue  = reminders.filter(r => !r.done && r.dueDate < today);
  const alertCount = dueToday.length + overdue.length;

  const filtered = useMemo(() => leads.filter(l => {
    const q = search.toLowerCase();
    const ms = !q || [l.name,l.county,l.state,l.phone,l.email].some(f=>f?.toLowerCase().includes(q));
    const mf = filterStage==="All" || l.stage===filterStage;
    return ms && mf;
  }), [leads, search, filterStage]);

  const byStage = useMemo(() => STAGES.map(s=>({stage:s, items:filtered.filter(l=>l.stage===s)})), [filtered]);

  const stats = useMemo(() => ({
    total: leads.length,
    active: leads.filter(l=>!["Closed","Dead"].includes(l.stage)).length,
    underContract: leads.filter(l=>l.stage==="Under Contract").length,
    closed: leads.filter(l=>l.stage==="Closed").length,
    pipelineVal: leads.filter(l=>l.offerPrice).reduce((a,b)=>a+Number(b.offerPrice),0),
  }), [leads]);

  const openDetail = (lead) => { setSelected(lead); setForm({...lead}); setEditMode(false); setView("detail"); };
  const openAdd    = () => { setForm(EMPTY_LEAD); setEditMode(true); setSelected(null); setView("add"); };

  const saveLead = () => {
    if (!form.name.trim()) return showToast("Name is required","error");
    if (selected) {
      const u = {...form, id:selected.id, date:selected.date};
      setLeads(ls=>ls.map(l=>l.id===selected.id?u:l));
      setSelected(u); showToast("Lead saved ✓");
    } else {
      setLeads(ls=>[{...form,id:uid(),date:today},...ls]);
      showToast("Lead added ✓"); setView("pipeline");
    }
    setEditMode(false);
  };

  const deleteLead = (id) => {
    setLeads(ls=>ls.filter(l=>l.id!==id));
    setReminders(rs=>rs.filter(r=>r.leadId!==id));
    setView("pipeline"); showToast("Lead deleted");
  };

  const updateStage = (id, stage) => {
    setLeads(ls=>ls.map(l=>l.id===id?{...l,stage}:l));
    if (selected?.id===id) setSelected(s=>({...s,stage}));
    showToast(`Moved to ${stage}`);
  };

  const saveReminder = () => {
    if (!remForm.text.trim() || !remForm.dueDate) return showToast("Fill all fields","error");
    const linkedLead = leads.find(l=>l.id===remForm.leadId);
    setReminders(rs=>[...rs,{
      id: uid(), leadId: remForm.leadId,
      leadName: linkedLead?.name || "General",
      text: remForm.text, dueDate: remForm.dueDate, done:false
    }]);
    setRemForm(EMPTY_REM); setShowRemForm(false); showToast("Reminder set ✓");
  };

  const toggleRem = (id) => setReminders(rs=>rs.map(r=>r.id===id?{...r,done:!r.done}:r));
  const deleteRem = (id) => setReminders(rs=>rs.filter(r=>r.id!==id));

  const mao = Math.max(0, (calc.arv*(calc.discount/100)) - calc.repairs - calc.wholesale);

  // ── STYLES ──
  const S = {
    app:  { fontFamily:"'Source Serif 4',Georgia,serif", background:"#0c0e14", minHeight:"100vh", color:"#e8e2d5" },
    header: { borderBottom:"1px solid #1a1d28", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0c0e14", position:"sticky", top:0, zIndex:100 },
    logo: { fontFamily:"'Playfair Display','Georgia',serif", fontSize:18, fontWeight:700, letterSpacing:1 },
    body: { padding:"24px 28px" },
    card: { background:"#13161f", border:"1px solid #1e2232", borderRadius:12 },
    input: { background:"#0f1117", border:"1px solid #1e2232", borderRadius:7, color:"#e8e2d5", padding:"10px 14px", fontSize:14, width:"100%", outline:"none", fontFamily:"inherit" },
    label: { fontSize:11, color:"#4b5563", letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:6 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
    flex:  { display:"flex", gap:10, alignItems:"center" },
  };

  const Btn = ({children, variant="ghost", onClick, style={}}) => {
    const base = { cursor:"pointer", border:"none", borderRadius:7, fontFamily:"inherit", fontSize:13, padding:"9px 18px", transition:"all .15s" };
    const variants = {
      gold:   { background:"linear-gradient(135deg,#c8973a,#e8b84b)", color:"#0c0e14", fontWeight:700 },
      ghost:  { background:"transparent", color:"#6b7280", border:"1px solid #22263a" },
      danger: { background:"#1f0a0a", color:"#f87171", border:"1px solid #7f1d1d" },
      sm:     { background:"transparent", color:"#6b7280", border:"1px solid #22263a", padding:"5px 12px", fontSize:12 },
    };
    return <button style={{...base,...variants[variant],...style}} onClick={onClick}>{children}</button>;
  };

  const Field = ({label, fkey, type="text", full=false}) => (
    <div style={{gridColumn:full?"1/-1":"auto"}}>
      <label style={S.label}>{label}</label>
      {editMode ? (
        type==="select" ? (
          <select style={S.input} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        ) : type==="textarea" ? (
          <textarea style={{...S.input,resize:"vertical"}} rows={4} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}/>
        ) : (
          <input style={S.input} type={type} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}/>
        )
      ) : (
        <div style={{color:"#c8c2b5",fontSize:14,padding:"4px 0",minHeight:26}}>
          {["askingPrice","offerPrice","arv","repairCost"].includes(fkey) ? fmt$(selected?.[fkey]) : selected?.[fkey] || <span style={{color:"#2a2d3a"}}>—</span>}
        </div>
      )}
    </div>
  );

  const StagePill = ({stage}) => (
    <span style={{padding:"3px 11px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",background:STAGE_COLORS[stage]+"22",color:STAGE_COLORS[stage]}}>
      {stage}
    </span>
  );

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,500;0,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#111318}
        ::-webkit-scrollbar-thumb{background:#2a2d3a;border-radius:3px}
        input,select,textarea{font-family:inherit}
        input:focus,select:focus,textarea:focus{border-color:#c8973a66 !important;outline:none}
        button:hover{opacity:.9}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeUp .22s ease}
        @keyframes toastIn{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}
        .p-card:hover{border-color:#c8973a55 !important;transform:translateY(-1px);box-shadow:0 4px 20px #00000050}
        .rem-row:hover{border-color:#2a2d3a !important}
        .nav-btn:hover{color:#c8973a !important}
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",top:20,right:20,zIndex:999,background:toast.type==="error"?"#1f0a0a":"#0a1f12",border:`1px solid ${toast.type==="error"?"#ef4444":"#22c55e"}`,color:toast.type==="error"?"#fca5a5":"#86efac",borderRadius:9,padding:"12px 22px",fontSize:14,animation:"toastIn .3s ease",boxShadow:"0 8px 32px #00000080"}}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#c8973a,#7a4a10)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⬡</div>
          <div>
            <div style={S.logo}>LandDesk</div>
            <div style={{fontSize:10,color:"#374151",letterSpacing:2,textTransform:"uppercase"}}>Wholesale CRM</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {[
            {id:"pipeline",label:"⬡ Pipeline"},
            {id:"table",   label:"≡ Table"},
            {id:"reminders",label:`🔔 Reminders${alertCount>0?` (${alertCount})`:""}`,alert:alertCount>0},
            {id:"calculator",label:"◈ Deal Calc"},
          ].map(n=>(
            <button key={n.id} className="nav-btn" onClick={()=>setView(n.id)} style={{cursor:"pointer",border:view===n.id?"1px solid #2a2d3a":"1px solid transparent",background:view===n.id?"#1a1d28":"transparent",color:view===n.id?"#c8973a":n.alert?"#f87171":"#6b7280",padding:"8px 16px",borderRadius:8,fontSize:13,fontFamily:"inherit",transition:"all .15s"}}>
              {n.label}
            </button>
          ))}
          <Btn variant="gold" onClick={openAdd} style={{marginLeft:8}}>+ Add Lead</Btn>
        </div>
      </div>

      <div style={S.body}>

        {/* STATS */}
        {(view==="pipeline"||view==="table") && (
          <div className="fade" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24}}>
            {[
              {label:"Total Leads",   val:stats.total,           icon:"👥", color:"#c8973a"},
              {label:"Active",        val:stats.active,          icon:"🔥", color:"#f59e0b"},
              {label:"Under Contract",val:stats.underContract,   icon:"📝", color:"#a855f7"},
              {label:"Closed",        val:stats.closed,          icon:"✅", color:"#22c55e"},
              {label:"Pipeline Value",val:fmt$(stats.pipelineVal),icon:"💰", color:"#10b981"},
            ].map(s=>(
              <div key={s.label} style={{...S.card,padding:20}}>
                <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
                <div style={{fontSize:24,fontWeight:700,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.val}</div>
                <div style={{fontSize:11,color:"#4b5563",marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* SEARCH */}
        {(view==="pipeline"||view==="table") && (
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <input style={{...S.input,maxWidth:280}} placeholder="🔍  Search leads…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={{...S.input,maxWidth:170}} value={filterStage} onChange={e=>setFilterStage(e.target.value)}>
              <option value="All">All Stages</option>
              {STAGES.map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{marginLeft:"auto",fontSize:13,color:"#374151",alignSelf:"center"}}>{filtered.length} lead{filtered.length!==1?"s":""}</div>
          </div>
        )}

        {/* ── PIPELINE ── */}
        {view==="pipeline" && (
          <div className="fade" style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:12}}>
            {byStage.map(({stage,items})=>(
              <div key={stage} style={{background:"#0f1117",border:"1px solid #1a1d28",borderRadius:10,minWidth:185,flex:1,padding:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:STAGE_COLORS[stage]}}>{stage}</span>
                  <span style={{background:"#1a1d28",color:"#4b5563",borderRadius:20,padding:"2px 8px",fontSize:11}}>{items.length}</span>
                </div>
                {items.length===0 && <div style={{fontSize:12,color:"#1e2232",textAlign:"center",padding:"20px 0"}}>Empty</div>}
                {items.map(lead=>(
                  <div key={lead.id} className="p-card" onClick={()=>openDetail(lead)}
                    style={{background:"#161922",border:"1px solid #1e2232",borderRadius:8,padding:13,cursor:"pointer",marginBottom:8,transition:"all .15s"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e8e2d5",marginBottom:3}}>{lead.name}</div>
                    <div style={{fontSize:11,color:"#4b5563",marginBottom:8}}>{lead.county}, {lead.state}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"#374151"}}>{fmtAc(lead.acres)}</span>
                      <span style={{color:"#c8973a",fontWeight:600}}>{lead.offerPrice?fmt$(lead.offerPrice):"No offer"}</span>
                    </div>
                    {reminders.filter(r=>r.leadId===lead.id&&!r.done).length>0 && (
                      <div style={{marginTop:7,fontSize:11,color:"#f59e0b"}}>🔔 {reminders.filter(r=>r.leadId===lead.id&&!r.done).length} reminder(s)</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── TABLE ── */}
        {view==="table" && (
          <div className="fade" style={{...S.card,overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid #1e2232"}}>
                  {["Name","Location","Acres","Asking","Offer","ARV","Stage","Date",""].map(h=>(
                    <th key={h} style={{padding:"12px 16px",textAlign:"left",color:"#374151",fontWeight:600,fontSize:11,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l,i)=>(
                  <tr key={l.id} style={{borderBottom:"1px solid #111318",background:i%2?"#0f1117":"transparent"}}>
                    <td style={{padding:"11px 16px"}}><div style={{fontWeight:600,color:"#e8e2d5"}}>{l.name}</div><div style={{fontSize:11,color:"#374151"}}>{l.phone}</div></td>
                    <td style={{padding:"11px 16px",color:"#6b7280"}}>{l.county}, {l.state}</td>
                    <td style={{padding:"11px 16px",color:"#6b7280"}}>{fmtAc(l.acres)}</td>
                    <td style={{padding:"11px 16px",color:"#6b7280"}}>{fmt$(l.askingPrice)}</td>
                    <td style={{padding:"11px 16px",color:"#c8973a",fontWeight:600}}>{fmt$(l.offerPrice)}</td>
                    <td style={{padding:"11px 16px",color:"#6b7280"}}>{fmt$(l.arv)}</td>
                    <td style={{padding:"11px 16px"}}><StagePill stage={l.stage}/></td>
                    <td style={{padding:"11px 16px",color:"#374151"}}>{l.date}</td>
                    <td style={{padding:"11px 16px"}}><Btn variant="sm" onClick={()=>openDetail(l)}>View</Btn></td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan={9} style={{padding:48,textAlign:"center",color:"#2a2d3a"}}>No leads found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── REMINDERS ── */}
        {view==="reminders" && (
          <div className="fade" style={{maxWidth:680,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22}}>Reminders</h2>
              <Btn variant="gold" onClick={()=>setShowRemForm(v=>!v)}>+ New Reminder</Btn>
            </div>

            {showRemForm && (
              <div className="fade" style={{...S.card,padding:22,marginBottom:20}}>
                <div style={{...S.grid2,marginBottom:14}}>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={S.label}>Reminder Note</label>
                    <input style={S.input} placeholder="e.g. Follow up call" value={remForm.text} onChange={e=>setRemForm(f=>({...f,text:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={S.label}>Due Date</label>
                    <input style={S.input} type="date" value={remForm.dueDate} onChange={e=>setRemForm(f=>({...f,dueDate:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={S.label}>Link to Lead (optional)</label>
                    <select style={S.input} value={remForm.leadId} onChange={e=>setRemForm(f=>({...f,leadId:e.target.value}))}>
                      <option value="">— None —</option>
                      {leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn variant="gold" onClick={saveReminder}>Save Reminder</Btn>
                  <Btn variant="ghost" onClick={()=>setShowRemForm(false)}>Cancel</Btn>
                </div>
              </div>
            )}

            {[
              {list:overdue,   label:"Overdue",  color:"#ef4444", dot:"#ef444488"},
              {list:dueToday,  label:"Due Today", color:"#f59e0b", dot:"#f59e0b88"},
              {list:reminders.filter(r=>!r.done&&r.dueDate>today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)), label:"Upcoming", color:"#6b7280", dot:null},
              {list:reminders.filter(r=>r.done), label:"Completed", color:"#374151", dot:null},
            ].map(({list,label,color,dot}) => list.length>0 && (
              <div key={label} style={{marginBottom:22}}>
                <div style={{fontSize:11,color,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                  {dot && <span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",boxShadow:`0 0 6px ${dot}`}}/>}
                  {label} ({list.length})
                </div>
                {list.map(r => (
                  <RemRow key={r.id} r={r} today={today} onToggle={toggleRem} onDelete={deleteRem}
                    onViewLead={id=>{const l=leads.find(x=>x.id===id);if(l)openDetail(l);}}/>
                ))}
              </div>
            ))}

            {reminders.length===0 && (
              <div style={{textAlign:"center",padding:60,color:"#2a2d3a",fontSize:15}}>No reminders yet — add one above ↑</div>
            )}
          </div>
        )}

        {/* ── CALCULATOR ── */}
        {view==="calculator" && (
          <div className="fade" style={{maxWidth:620,margin:"0 auto"}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:20}}>Deal Calculator</h2>
            <div style={{...S.card,padding:28}}>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:20,lineHeight:1.7,background:"#0f1117",padding:"12px 16px",borderRadius:8,border:"1px solid #1e2232"}}>
                Formula: <span style={{color:"#c8973a"}}>MAO = (ARV × Discount%) − Repairs − Your Fee</span>
              </div>
              <div style={{...S.grid2,marginBottom:22}}>
                {[
                  {label:"After Repair Value (ARV) $", key:"arv",      hint:"What the land will sell for"},
                  {label:"Discount % (65–75% typical)",key:"discount",  hint:"Buy price as % of ARV"},
                  {label:"Repair / Improvement Cost $",key:"repairs",   hint:"Buyer's estimated costs"},
                  {label:"Your Wholesale Fee $",        key:"wholesale", hint:"Your assignment / profit"},
                ].map(f=>(
                  <div key={f.key}>
                    <label style={S.label}>{f.label}</label>
                    <input style={S.input} type="number" value={calc[f.key]} onChange={e=>setCalc(c=>({...c,[f.key]:Number(e.target.value)}))}/>
                    <div style={{fontSize:11,color:"#374151",marginTop:4}}>{f.hint}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"linear-gradient(135deg,#0a160a,#0c1810)",border:"1px solid #22c55e22",borderRadius:10,padding:22}}>
                <div style={{fontSize:11,color:"#4b5563",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Results</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                  {[
                    {label:"Max Allowable Offer", val:fmt$(mao),              color:"#22c55e", big:true},
                    {label:"Your Fee",             val:fmt$(calc.wholesale),   color:"#c8973a"},
                    {label:"Buyer All-In",         val:fmt$(mao+calc.repairs), color:"#6b7280"},
                  ].map(r=>(
                    <div key={r.label} style={{background:"#0c0e14",border:`1px solid ${r.color}22`,borderRadius:8,padding:14}}>
                      <div style={{fontSize:r.big?26:18,fontWeight:700,color:r.color,fontFamily:"'Playfair Display',serif"}}>{r.val}</div>
                      <div style={{fontSize:11,color:"#374151",marginTop:4}}>{r.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:13,color:"#4b5563",lineHeight:1.8,background:"#0c0e14",padding:"10px 14px",borderRadius:7}}>
                  ({fmt$(calc.arv)} × {calc.discount}%) − {fmt$(calc.repairs)} − {fmt$(calc.wholesale)} = <span style={{color:"#22c55e",fontWeight:700}}>{fmt$(mao)} MAO</span>
                </div>
              </div>

              {leads.filter(l=>l.arv).length>0 && (
                <div style={{marginTop:20,paddingTop:20,borderTop:"1px solid #1e2232"}}>
                  <div style={{fontSize:12,color:"#4b5563",marginBottom:10}}>Quick-fill from a lead:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {leads.filter(l=>l.arv).map(l=>(
                      <Btn key={l.id} variant="sm" onClick={()=>setCalc(c=>({...c,arv:Number(l.arv),repairs:Number(l.repairCost)||0}))}>
                        {l.name}
                      </Btn>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DETAIL / ADD ── */}
        {(view==="detail"||view==="add") && (
          <div className="fade" style={{maxWidth:720,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <Btn variant="ghost" onClick={()=>setView("pipeline")}>← Back</Btn>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20}}>{view==="add"?"New Lead":editMode?"Edit: "+selected?.name:selected?.name}</h2>
              {view==="detail"&&!editMode&&<StagePill stage={selected?.stage}/>}
            </div>

            <div style={{...S.card,padding:28}}>
              {/* Stage mover */}
              {view==="detail"&&!editMode&&(
                <div style={{marginBottom:24,paddingBottom:20,borderBottom:"1px solid #1a1d28"}}>
                  <div style={{...S.label,marginBottom:10}}>Move Stage</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {STAGES.map(s=>(
                      <button key={s} onClick={()=>updateStage(selected.id,s)}
                        style={{padding:"5px 14px",fontSize:12,fontFamily:"inherit",background:selected?.stage===s?STAGE_COLORS[s]+"33":"#1a1d28",color:selected?.stage===s?STAGE_COLORS[s]:"#6b7280",border:`1px solid ${selected?.stage===s?STAGE_COLORS[s]+"66":"#22263a"}`,borderRadius:20,cursor:"pointer",transition:"all .15s"}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={S.grid2}>
                <Field label="Full Name *"         fkey="name"        type="text"   full/>
                <Field label="Phone"               fkey="phone"       type="text"/>
                <Field label="Email"               fkey="email"       type="email"/>
                <Field label="County"              fkey="county"      type="text"/>
                <Field label="State"               fkey="state"       type="text"/>
                <Field label="Acres"               fkey="acres"       type="number"/>
                <Field label="Asking Price ($)"    fkey="askingPrice" type="number"/>
                <Field label="Your Offer ($)"      fkey="offerPrice"  type="number"/>
                <Field label="ARV ($)"             fkey="arv"         type="number"/>
                <Field label="Repair Cost ($)"     fkey="repairCost"  type="number"/>
                <Field label="Stage"               fkey="stage"       type="select"/>
                <Field label="Assigned To"         fkey="assignedTo"  type="text"/>
                <Field label="Notes"               fkey="notes"       type="textarea" full/>
              </div>

              <div style={{display:"flex",gap:10,marginTop:24,paddingTop:20,borderTop:"1px solid #1a1d28",flexWrap:"wrap"}}>
                {editMode ? (
                  <>
                    <Btn variant="gold" onClick={saveLead}>💾 Save Lead</Btn>
                    {view==="detail"&&<Btn variant="ghost" onClick={()=>setEditMode(false)}>Cancel</Btn>}
                  </>
                ) : (
                  <>
                    <Btn variant="gold" onClick={()=>setEditMode(true)}>✏️ Edit</Btn>
                    <Btn variant="ghost" onClick={()=>{setRemForm({...EMPTY_REM,leadId:selected?.id});setShowRemForm(true);setView("reminders");}}>🔔 Add Reminder</Btn>
                    <Btn variant="ghost" onClick={()=>setCalc(c=>({...c,arv:Number(selected?.arv)||0,repairs:Number(selected?.repairCost)||0}))&&setView("calculator")}>◈ Calculate Deal</Btn>
                    <Btn variant="danger" style={{marginLeft:"auto"}} onClick={()=>deleteLead(selected.id)}>🗑 Delete</Btn>
                  </>
                )}
              </div>
            </div>

            {/* Lead reminders */}
            {view==="detail" && (
              <div style={{marginTop:20}}>
                <div style={{fontSize:13,color:"#4b5563",marginBottom:12,fontWeight:600,letterSpacing:.5}}>
                  Reminders for {selected?.name}
                </div>
                {reminders.filter(r=>r.leadId===selected?.id).length===0 ? (
                  <div style={{fontSize:13,color:"#2a2d3a"}}>No reminders — add one above.</div>
                ) : (
                  reminders.filter(r=>r.leadId===selected?.id).map(r=>(
                    <RemRow key={r.id} r={r} today={today} onToggle={toggleRem} onDelete={deleteRem} onViewLead={()=>{}}/>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── REMINDER ROW ─────────────────────────────────────────────────────────────
function RemRow({r, today, onToggle, onDelete, onViewLead}) {
  const isOverdue = !r.done && r.dueDate < today;
  const isToday   = !r.done && r.dueDate === today;
  return (
    <div className="rem-row" style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:9,padding:"13px 16px",display:"flex",alignItems:"flex-start",gap:12,marginBottom:8,transition:"all .15s",opacity:r.done?.65:1}}>
      <div onClick={()=>onToggle(r.id)} style={{marginTop:2,cursor:"pointer",flexShrink:0}}>
        <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${r.done?"#22c55e":isOverdue?"#ef4444":isToday?"#f59e0b":"#2a2d3a"}`,background:r.done?"#22c55e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#0c0e14",transition:"all .15s"}}>
          {r.done&&"✓"}
        </div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,color:r.done?"#4b5563":"#e8e2d5",textDecoration:r.done?"line-through":"none",marginBottom:4}}>{r.text}</div>
        <div style={{display:"flex",gap:14,fontSize:12,flexWrap:"wrap"}}>
          <span style={{color:isOverdue?"#ef4444":isToday?"#f59e0b":"#374151"}}>{isOverdue?"⚠ Overdue · ":isToday?"● Today · ":""}{r.dueDate}</span>
          {r.leadName&&<span style={{color:"#4b5563"}}>{r.leadName}</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        {r.leadId&&<button onClick={()=>onViewLead(r.leadId)} style={{background:"transparent",border:"1px solid #1e2232",borderRadius:6,color:"#4b5563",padding:"4px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>View Lead</button>}
        <button onClick={()=>onDelete(r.id)} style={{background:"transparent",border:"none",color:"#374151",cursor:"pointer",padding:"4px 8px",fontSize:18,lineHeight:1}}>×</button>
      </div>
    </div>
  );
}
