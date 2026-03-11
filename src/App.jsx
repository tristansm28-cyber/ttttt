import { useState, useMemo, useEffect, useRef } from "react";

// ─── PERSISTENT STORAGE ──────────────────────────────────────────────────────
// Uses window.storage API (persists across sessions in Claude artifacts)
const KEYS = { leads: "ld_leads_v2", reminders: "ld_reminders_v2" };

async function load(key) {
  try {
    const res = await window.storage.get(key);
    if (res && res.value) return JSON.parse(res.value);
  } catch {}
  return null;
}

async function save(key, data) {
  try {
    await window.storage.set(key, JSON.stringify(data));
    return true;
  } catch { return false; }
}

// ─── SEED DATA ───────────────────────────────────────────────────────────────
const SEED_LEADS = [
  { id:"l1", name:"John Hargrove", phone:"555-201-4433", email:"j.hargrove@email.com", county:"Travis County", state:"TX", acres:42, askingPrice:185000, offerPrice:120000, arv:210000, repairCost:0, stage:"Negotiating", notes:"Owner motivated, inherited land. Prefers cash deal.", date:"2026-02-14", assignedTo:"Me" },
  { id:"l2", name:"Maria Delgado", phone:"555-309-8821", email:"mdelgado@mail.com", county:"Bexar County", state:"TX", acres:18, askingPrice:72000, offerPrice:48000, arv:85000, repairCost:0, stage:"Contacted", notes:"Left voicemail x2. Best time: mornings.", date:"2026-02-28", assignedTo:"Me" },
  { id:"l3", name:"Frank Simmons", phone:"555-447-2210", email:"", county:"Hays County", state:"TX", acres:110, askingPrice:450000, offerPrice:310000, arv:500000, repairCost:0, stage:"Under Contract", notes:"Signed PSA 3/1. Closing set for 3/28.", date:"2026-03-01", assignedTo:"Me" },
  { id:"l4", name:"Linda Chu", phone:"555-512-9034", email:"lchu@webmail.com", county:"Williamson County", state:"TX", acres:6, askingPrice:28000, offerPrice:0, arv:35000, repairCost:0, stage:"Lead", notes:"Direct mail response.", date:"2026-03-08", assignedTo:"Me" },
];
const SEED_REMINDERS = [
  { id:"r1", leadId:"l2", leadName:"Maria Delgado", text:"Morning follow-up call", dueDate:"2026-03-12", done:false },
  { id:"r2", leadId:"l3", leadName:"Frank Simmons", text:"Confirm title company for closing", dueDate:"2026-03-25", done:false },
];

const STAGES = ["Lead","Contacted","Negotiating","Under Contract","Closed","Dead"];
const SC = { "Lead":"#f59e0b","Contacted":"#3b82f6","Negotiating":"#a855f7","Under Contract":"#10b981","Closed":"#22c55e","Dead":"#6b7280" };
const EMPTY_L = { name:"",phone:"",email:"",county:"",state:"TX",acres:"",askingPrice:"",offerPrice:"",arv:"",repairCost:"",stage:"Lead",notes:"",assignedTo:"Me" };
const EMPTY_R = { text:"", dueDate:"", leadId:"" };

const f$ = v => v && Number(v) ? `$${Number(v).toLocaleString()}` : "—";
const fA = v => v ? `${v} ac` : "—";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const todayISO = () => new Date().toISOString().slice(0,10);

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads]         = useState(null); // null = loading
  const [reminders, setReminders] = useState(null);
  const [view, setView]           = useState("pipeline");
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_L);
  const [editing, setEditing]     = useState(false);
  const [search, setSearch]       = useState("");
  const [stageF, setStageF]       = useState("All");
  const [toast, setToast]         = useState(null);
  const [remForm, setRemForm]     = useState(EMPTY_R);
  const [showRF, setShowRF]       = useState(false);
  const [calc, setCalc]           = useState({ arv:0, disc:70, rep:0, fee:15000 });
  const [saveStatus, setSaveStatus] = useState("saved"); // saved | saving | error
  const saveTimer = useRef(null);

  const TODAY = todayISO();

  // ── LOAD on mount ──
  useEffect(() => {
    (async () => {
      const [l, r] = await Promise.all([load(KEYS.leads), load(KEYS.reminders)]);
      setLeads(l || SEED_LEADS);
      setReminders(r || SEED_REMINDERS);
    })();
  }, []);

  // ── SAVE leads whenever they change ──
  useEffect(() => {
    if (leads === null) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await save(KEYS.leads, leads);
      setSaveStatus(ok ? "saved" : "error");
    }, 600);
  }, [leads]);

  // ── SAVE reminders whenever they change ──
  useEffect(() => {
    if (reminders === null) return;
    save(KEYS.reminders, reminders);
  }, [reminders]);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // Derived
  const overdueRems  = (reminders||[]).filter(r=>!r.done && r.dueDate < TODAY);
  const todayRems    = (reminders||[]).filter(r=>!r.done && r.dueDate === TODAY);
  const alertCount   = overdueRems.length + todayRems.length;

  const filtered = useMemo(() => (leads||[]).filter(l => {
    const q = search.toLowerCase();
    return (!q || [l.name,l.county,l.state,l.phone,l.email].some(x=>x?.toLowerCase().includes(q)))
        && (stageF==="All" || l.stage===stageF);
  }), [leads, search, stageF]);

  const byStage = useMemo(() => STAGES.map(s=>({ stage:s, items:filtered.filter(l=>l.stage===s) })), [filtered]);

  const stats = useMemo(() => ({
    total:    (leads||[]).length,
    active:   (leads||[]).filter(l=>!["Closed","Dead"].includes(l.stage)).length,
    contract: (leads||[]).filter(l=>l.stage==="Under Contract").length,
    closed:   (leads||[]).filter(l=>l.stage==="Closed").length,
    val:      (leads||[]).filter(l=>l.offerPrice).reduce((a,b)=>a+Number(b.offerPrice),0),
  }), [leads]);

  // ── LEAD ACTIONS ──
  const openDetail = l => { setSelected(l); setForm({...l}); setEditing(false); setView("detail"); };
  const openAdd    = () => { setForm(EMPTY_L); setEditing(true); setSelected(null); setView("add"); };

  const saveLead = () => {
    if (!form.name?.trim()) return showToast("Name is required","err");
    if (selected) {
      const u = {...form, id:selected.id, date:selected.date};
      setLeads(ls => ls.map(l=>l.id===selected.id ? u : l));
      setSelected(u); showToast("Lead saved ✓");
    } else {
      setLeads(ls => [{ ...form, id:uid(), date:TODAY }, ...ls]);
      showToast("Lead added ✓"); setView("pipeline");
    }
    setEditing(false);
  };

  const deleteLead = id => {
    setLeads(ls=>ls.filter(l=>l.id!==id));
    setReminders(rs=>rs.filter(r=>r.leadId!==id));
    setView("pipeline"); showToast("Deleted");
  };

  const moveStage = (id, stage) => {
    setLeads(ls=>ls.map(l=>l.id===id?{...l,stage}:l));
    if (selected?.id===id) setSelected(s=>({...s,stage}));
    showToast(`→ ${stage}`);
  };

  // ── REMINDER ACTIONS ──
  const saveRem = () => {
    if (!remForm.text?.trim() || !remForm.dueDate) return showToast("Fill all fields","err");
    const linked = (leads||[]).find(l=>l.id===remForm.leadId);
    setReminders(rs=>[...rs,{ id:uid(), leadId:remForm.leadId, leadName:linked?.name||"General", text:remForm.text, dueDate:remForm.dueDate, done:false }]);
    setRemForm(EMPTY_R); setShowRF(false); showToast("Reminder saved ✓");
  };
  const toggleRem = id => setReminders(rs=>rs.map(r=>r.id===id?{...r,done:!r.done}:r));
  const deleteRem = id => setReminders(rs=>rs.filter(r=>r.id!==id));

  // ── CALCULATOR ──
  const mao = Math.max(0, (calc.arv*(calc.disc/100)) - calc.rep - calc.fee);

  // ── PEOPLE SEARCH ──
  const searchPerson = (lead) => {
    const name = encodeURIComponent(lead.name.trim());
    const state = encodeURIComponent(lead.state?.trim() || "");
    window.open(`https://www.truepeoplesearch.com/results?name=${name}&citystatezip=${state}`, "_blank");
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  if (leads === null) return (
    <div style={{background:"#0c0e14",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:"#c8973a",fontFamily:"Georgia,serif"}}>
      <div style={{fontSize:32}}>⬡</div>
      <div style={{fontSize:16,letterSpacing:2}}>Loading LandDesk…</div>
    </div>
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Serif+4:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0c0e14}
    ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0c0e14}::-webkit-scrollbar-thumb{background:#252838;border-radius:3px}
    input,select,textarea{font-family:'Source Serif 4',Georgia,serif}
    input:focus,select:focus,textarea:focus{border-color:#c8973a !important;outline:none}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .fade{animation:fadeUp .2s ease}
    @keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
    .pcard{transition:all .15s;cursor:pointer}
    .pcard:hover{border-color:#c8973a66 !important;transform:translateY(-2px);box-shadow:0 6px 24px #00000060}
    .remrow:hover{border-color:#252838 !important}
    .navbtn:hover{color:#c8973a !important}
    .stageBtn:hover{opacity:.85}
  `;

  const inp = { background:"#0f1117", border:"1px solid #1e2232", borderRadius:7, color:"#e8e2d5", padding:"10px 13px", fontSize:14, width:"100%", fontFamily:"inherit" };
  const lbl = { fontSize:11, color:"#4b5563", letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:5 };

  const GoldBtn = ({children, onClick, style={}}) => (
    <button onClick={onClick} style={{cursor:"pointer",border:"none",borderRadius:7,fontFamily:"inherit",fontSize:13,padding:"9px 20px",background:"linear-gradient(135deg,#c8973a,#e8b84b)",color:"#0c0e14",fontWeight:700,transition:"all .15s",...style}}>
      {children}
    </button>
  );
  const GhostBtn = ({children, onClick, style={}}) => (
    <button onClick={onClick} style={{cursor:"pointer",border:"1px solid #1e2232",borderRadius:7,fontFamily:"inherit",fontSize:13,padding:"8px 16px",background:"transparent",color:"#6b7280",transition:"all .15s",...style}}>
      {children}
    </button>
  );
  const DangerBtn = ({children, onClick}) => (
    <button onClick={onClick} style={{cursor:"pointer",border:"1px solid #7f1d1d",borderRadius:7,fontFamily:"inherit",fontSize:13,padding:"8px 16px",background:"#1f0a0a",color:"#f87171"}}>
      {children}
    </button>
  );

  const Pill = ({stage}) => (
    <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",background:SC[stage]+"22",color:SC[stage]}}>
      {stage}
    </span>
  );

  const EditField = ({label, fkey, type="text", full=false}) => (
    <div style={{gridColumn:full?"1/-1":"auto"}}>
      <label style={lbl}>{label}</label>
      {editing ? (
        type==="select" ? (
          <select style={inp} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        ) : type==="textarea" ? (
          <textarea style={{...inp,resize:"vertical"}} rows={4} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}/>
        ) : (
          <input style={inp} type={type} value={form[fkey]||""} onChange={e=>setForm(f=>({...f,[fkey]:e.target.value}))}/>
        )
      ) : (
        <div style={{color:"#c8c2b5",fontSize:14,padding:"5px 0",minHeight:26}}>
          {["askingPrice","offerPrice","arv","repairCost"].includes(fkey) ? f$(selected?.[fkey]) : selected?.[fkey] || <span style={{color:"#252838"}}>—</span>}
        </div>
      )}
    </div>
  );

  return (
    <div style={{fontFamily:"'Source Serif 4',Georgia,serif",background:"#0c0e14",minHeight:"100vh",color:"#e8e2d5"}}>
      <style>{css}</style>

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",top:18,right:18,zIndex:9999,padding:"11px 20px",borderRadius:9,fontSize:14,animation:"toastIn .25s ease",boxShadow:"0 8px 32px #00000080",background:toast.type==="err"?"#1f0a0a":"#0a1a0a",border:`1px solid ${toast.type==="err"?"#ef4444":"#22c55e"}`,color:toast.type==="err"?"#fca5a5":"#86efac"}}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{borderBottom:"1px solid #161925",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0c0e14",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#c8973a,#7a4510)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⬡</div>
          <div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:17,fontWeight:700,color:"#e8e2d5",letterSpacing:.5}}>LandDesk</div>
            <div style={{fontSize:10,color:"#374151",letterSpacing:2,textTransform:"uppercase"}}>Wholesale CRM</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {[
            {id:"pipeline", label:"⬡ Pipeline"},
            {id:"table",    label:"≡ Table"},
            {id:"reminders",label:`🔔 Reminders${alertCount>0?` (${alertCount})`:""}`, alert:alertCount>0},
            {id:"calculator",label:"◈ Deal Calc"},
          ].map(n=>(
            <button key={n.id} className="navbtn" onClick={()=>setView(n.id)}
              style={{cursor:"pointer",border:view===n.id?"1px solid #252838":"1px solid transparent",background:view===n.id?"#161925":"transparent",color:view===n.id?"#c8973a":n.alert?"#f87171":"#6b7280",padding:"7px 15px",borderRadius:7,fontSize:13,fontFamily:"inherit",transition:"all .15s"}}>
              {n.label}
            </button>
          ))}
          <GoldBtn onClick={openAdd} style={{marginLeft:6}}>+ Add Lead</GoldBtn>
        </div>
        {/* Save indicator */}
        <div style={{position:"absolute",bottom:4,right:24,fontSize:10,color:saveStatus==="error"?"#ef4444":saveStatus==="saving"?"#f59e0b":"#374151",letterSpacing:.5}}>
          {saveStatus==="saving"?"● saving…":saveStatus==="error"?"⚠ save failed":"● saved"}
        </div>
      </div>

      <div style={{padding:"22px 24px"}}>

        {/* STATS */}
        {(view==="pipeline"||view==="table") && (
          <div className="fade" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:22}}>
            {[
              {label:"Total Leads",    val:stats.total,    icon:"👥", c:"#c8973a"},
              {label:"Active",         val:stats.active,   icon:"🔥", c:"#f59e0b"},
              {label:"Under Contract", val:stats.contract, icon:"📝", c:"#a855f7"},
              {label:"Closed",         val:stats.closed,   icon:"✅", c:"#22c55e"},
              {label:"Pipeline Value", val:f$(stats.val),  icon:"💰", c:"#10b981"},
            ].map(s=>(
              <div key={s.label} style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:11,padding:"18px 16px"}}>
                <div style={{fontSize:20,marginBottom:7}}>{s.icon}</div>
                <div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Playfair Display',serif"}}>{s.val}</div>
                <div style={{fontSize:11,color:"#4b5563",marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* SEARCH */}
        {(view==="pipeline"||view==="table") && (
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            <input style={{...inp,maxWidth:270}} placeholder="🔍  Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={{...inp,maxWidth:160}} value={stageF} onChange={e=>setStageF(e.target.value)}>
              <option value="All">All Stages</option>
              {STAGES.map(s=><option key={s}>{s}</option>)}
            </select>
            <span style={{marginLeft:"auto",fontSize:12,color:"#374151",alignSelf:"center"}}>{filtered.length} lead{filtered.length!==1?"s":""}</span>
          </div>
        )}

        {/* ── PIPELINE ── */}
        {view==="pipeline" && (
          <div className="fade" style={{display:"flex",gap:9,overflowX:"auto",paddingBottom:10}}>
            {byStage.map(({stage,items})=>(
              <div key={stage} style={{background:"#0f1117",border:"1px solid #161925",borderRadius:10,minWidth:182,flex:1,padding:11}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",color:SC[stage]}}>{stage}</span>
                  <span style={{background:"#161925",color:"#374151",borderRadius:20,padding:"2px 7px",fontSize:11}}>{items.length}</span>
                </div>
                {items.length===0&&<div style={{fontSize:12,color:"#1e2232",textAlign:"center",padding:"18px 0"}}>Empty</div>}
                {items.map(l=>(
                  <div key={l.id} className="pcard" onClick={()=>openDetail(l)}
                    style={{background:"#161922",border:"1px solid #1e2232",borderRadius:8,padding:12,marginBottom:7}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e8e2d5",marginBottom:2}}>{l.name}</div>
                    <div style={{fontSize:11,color:"#374151",marginBottom:7}}>{l.county}, {l.state}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"#374151"}}>{fA(l.acres)}</span>
                      <span style={{color:"#c8973a",fontWeight:600}}>{l.offerPrice?f$(l.offerPrice):"No offer"}</span>
                    </div>
                    {(reminders||[]).filter(r=>r.leadId===l.id&&!r.done).length>0&&(
                      <div style={{marginTop:6,fontSize:11,color:"#f59e0b"}}>🔔 {(reminders||[]).filter(r=>r.leadId===l.id&&!r.done).length} reminder(s)</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── TABLE ── */}
        {view==="table" && (
          <div className="fade" style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:12,overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid #1e2232"}}>
                  {["Name","Location","Acres","Asking","Offer","ARV","Stage","Date",""].map(h=>(
                    <th key={h} style={{padding:"11px 15px",textAlign:"left",color:"#374151",fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l,i)=>(
                  <tr key={l.id} style={{borderBottom:"1px solid #111318",background:i%2?"#0f1117":"transparent"}}>
                    <td style={{padding:"10px 15px"}}><div style={{fontWeight:600,color:"#e8e2d5"}}>{l.name}</div><div style={{fontSize:11,color:"#374151"}}>{l.phone}</div></td>
                    <td style={{padding:"10px 15px",color:"#6b7280"}}>{l.county}, {l.state}</td>
                    <td style={{padding:"10px 15px",color:"#6b7280"}}>{fA(l.acres)}</td>
                    <td style={{padding:"10px 15px",color:"#6b7280"}}>{f$(l.askingPrice)}</td>
                    <td style={{padding:"10px 15px",color:"#c8973a",fontWeight:600}}>{f$(l.offerPrice)}</td>
                    <td style={{padding:"10px 15px",color:"#6b7280"}}>{f$(l.arv)}</td>
                    <td style={{padding:"10px 15px"}}><Pill stage={l.stage}/></td>
                    <td style={{padding:"10px 15px",color:"#374151"}}>{l.date}</td>
                    <td style={{padding:"10px 15px"}}><GhostBtn onClick={()=>openDetail(l)} style={{fontSize:12,padding:"5px 12px"}}>View</GhostBtn></td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={9} style={{padding:48,textAlign:"center",color:"#252838"}}>No leads found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── REMINDERS ── */}
        {view==="reminders" && (
          <div className="fade" style={{maxWidth:660,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:21}}>Reminders</h2>
              <GoldBtn onClick={()=>setShowRF(v=>!v)}>+ New Reminder</GoldBtn>
            </div>

            {showRF && (
              <div className="fade" style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:11,padding:20,marginBottom:18}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={lbl}>Note</label>
                    <input style={inp} placeholder="e.g. Follow up call" value={remForm.text} onChange={e=>setRemForm(f=>({...f,text:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lbl}>Due Date</label>
                    <input style={inp} type="date" value={remForm.dueDate} onChange={e=>setRemForm(f=>({...f,dueDate:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lbl}>Link to Lead</label>
                    <select style={inp} value={remForm.leadId} onChange={e=>setRemForm(f=>({...f,leadId:e.target.value}))}>
                      <option value="">— None —</option>
                      {(leads||[]).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <GoldBtn onClick={saveRem}>Save</GoldBtn>
                  <GhostBtn onClick={()=>setShowRF(false)}>Cancel</GhostBtn>
                </div>
              </div>
            )}

            {[
              { list:overdueRems, label:"Overdue", color:"#ef4444" },
              { list:todayRems,   label:"Due Today", color:"#f59e0b" },
              { list:(reminders||[]).filter(r=>!r.done&&r.dueDate>TODAY).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)), label:"Upcoming", color:"#6b7280" },
              { list:(reminders||[]).filter(r=>r.done), label:"Completed", color:"#2a2d3a" },
            ].map(({list,label,color})=> list.length>0 && (
              <div key={label} style={{marginBottom:20}}>
                <div style={{fontSize:11,color,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:9}}>{label} ({list.length})</div>
                {list.map(r=>(
                  <RemRow key={r.id} r={r} today={TODAY}
                    onToggle={toggleRem} onDelete={deleteRem}
                    onViewLead={id=>{const l=(leads||[]).find(x=>x.id===id);if(l)openDetail(l);}}/>
                ))}
              </div>
            ))}
            {(reminders||[]).length===0&&<div style={{textAlign:"center",padding:60,color:"#252838"}}>No reminders yet</div>}
          </div>
        )}

        {/* ── CALCULATOR ── */}
        {view==="calculator" && (
          <div className="fade" style={{maxWidth:600,margin:"0 auto"}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:21,marginBottom:18}}>Deal Calculator</h2>
            <div style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:12,padding:26}}>
              <div style={{fontSize:13,color:"#4b5563",marginBottom:18,padding:"10px 14px",background:"#0f1117",borderRadius:7,border:"1px solid #1e2232",lineHeight:1.7}}>
                Formula: <span style={{color:"#c8973a"}}>MAO = (ARV × Discount%) − Repairs − Your Fee</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                {[
                  {label:"ARV ($)",          key:"arv",  hint:"What land sells for on market"},
                  {label:"Discount % (65-75)",key:"disc", hint:"Your target as % of ARV"},
                  {label:"Repair Cost ($)",   key:"rep",  hint:"Buyer's improvement cost"},
                  {label:"Your Fee ($)",       key:"fee",  hint:"Your wholesale / assignment fee"},
                ].map(f=>(
                  <div key={f.key}>
                    <label style={lbl}>{f.label}</label>
                    <input style={inp} type="number" value={calc[f.key]} onChange={e=>setCalc(c=>({...c,[f.key]:Number(e.target.value)}))}/>
                    <div style={{fontSize:11,color:"#374151",marginTop:3}}>{f.hint}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"linear-gradient(135deg,#0a160a,#0b160b)",border:"1px solid #22c55e22",borderRadius:10,padding:20}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                  {[
                    {label:"Max Offer (MAO)", val:f$(mao),              color:"#22c55e", big:true},
                    {label:"Your Fee",         val:f$(calc.fee),         color:"#c8973a"},
                    {label:"Buyer All-In",     val:f$(mao+calc.rep),    color:"#6b7280"},
                  ].map(r=>(
                    <div key={r.label} style={{background:"#0c0e14",border:`1px solid ${r.color}20`,borderRadius:8,padding:13}}>
                      <div style={{fontSize:r.big?24:17,fontWeight:700,color:r.color,fontFamily:"'Playfair Display',serif"}}>{r.val}</div>
                      <div style={{fontSize:11,color:"#374151",marginTop:3}}>{r.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:"#374151",background:"#0c0e14",padding:"9px 13px",borderRadius:7,lineHeight:1.8}}>
                  ({f$(calc.arv)} × {calc.disc}%) − {f$(calc.rep)} − {f$(calc.fee)} = <span style={{color:"#22c55e",fontWeight:700}}>{f$(mao)}</span>
                </div>
              </div>
              {(leads||[]).filter(l=>l.arv).length>0&&(
                <div style={{marginTop:18,paddingTop:18,borderTop:"1px solid #1e2232"}}>
                  <div style={{fontSize:12,color:"#374151",marginBottom:9}}>Quick-fill from lead:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                    {(leads||[]).filter(l=>l.arv).map(l=>(
                      <GhostBtn key={l.id} onClick={()=>setCalc(c=>({...c,arv:Number(l.arv),rep:Number(l.repairCost)||0}))} style={{fontSize:12,padding:"5px 12px"}}>
                        {l.name}
                      </GhostBtn>
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
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <GhostBtn onClick={()=>setView("pipeline")} style={{padding:"7px 14px",fontSize:12}}>← Back</GhostBtn>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:19}}>{view==="add"?"New Lead":editing?"Edit: "+selected?.name:selected?.name}</h2>
              {view==="detail"&&!editing&&<Pill stage={selected?.stage}/>}
            </div>

            <div style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:12,padding:26}}>
              {/* Stage mover */}
              {view==="detail"&&!editing&&(
                <div style={{marginBottom:22,paddingBottom:18,borderBottom:"1px solid #161925"}}>
                  <div style={{...lbl,marginBottom:9}}>Move Stage</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {STAGES.map(s=>(
                      <button key={s} className="stageBtn" onClick={()=>moveStage(selected.id,s)}
                        style={{padding:"5px 13px",fontSize:12,fontFamily:"inherit",cursor:"pointer",transition:"all .15s",background:selected?.stage===s?SC[s]+"33":"#161925",color:selected?.stage===s?SC[s]:"#6b7280",border:`1px solid ${selected?.stage===s?SC[s]+"66":"#1e2232"}`,borderRadius:20}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:15}}>
                <EditField label="Full Name *"        fkey="name"        type="text"     full/>
                <EditField label="Phone"              fkey="phone"       type="text"/>
                <EditField label="Email"              fkey="email"       type="email"/>
                <EditField label="County"             fkey="county"      type="text"/>
                <EditField label="State"              fkey="state"       type="text"/>
                <EditField label="Acres"              fkey="acres"       type="number"/>
                <EditField label="Asking Price ($)"   fkey="askingPrice" type="number"/>
                <EditField label="Your Offer ($)"     fkey="offerPrice"  type="number"/>
                <EditField label="ARV ($)"            fkey="arv"         type="number"/>
                <EditField label="Repair Cost ($)"    fkey="repairCost"  type="number"/>
                <EditField label="Stage"              fkey="stage"       type="select"/>
                <EditField label="Assigned To"        fkey="assignedTo"  type="text"/>
                <EditField label="Notes"              fkey="notes"       type="textarea" full/>
              </div>

              <div style={{display:"flex",gap:8,marginTop:22,paddingTop:18,borderTop:"1px solid #161925",flexWrap:"wrap",alignItems:"center"}}>
                {editing ? (
                  <>
                    <GoldBtn onClick={saveLead}>💾 Save Lead</GoldBtn>
                    {view==="detail"&&<GhostBtn onClick={()=>setEditing(false)}>Cancel</GhostBtn>}
                  </>
                ) : (
                  <>
                    <GoldBtn onClick={()=>setEditing(true)}>✏️ Edit</GoldBtn>
                    <GhostBtn onClick={()=>{setRemForm({...EMPTY_R,leadId:selected?.id});setShowRF(true);setView("reminders");}}>🔔 Reminder</GhostBtn>
                    <GhostBtn onClick={()=>{setCalc(c=>({...c,arv:Number(selected?.arv)||0,rep:Number(selected?.repairCost)||0}));setView("calculator");}}>◈ Calculate</GhostBtn>
                    {/* TRUE PEOPLE SEARCH */}
                    <GhostBtn onClick={()=>searchPerson(selected)} style={{color:"#3b82f6",borderColor:"#3b82f633"}}>🔍 People Search</GhostBtn>
                    <DangerBtn onClick={()=>deleteLead(selected.id)}>🗑 Delete</DangerBtn>
                  </>
                )}
              </div>
            </div>

            {/* Reminders for this lead */}
            {view==="detail"&&(
              <div style={{marginTop:18}}>
                <div style={{fontSize:12,color:"#4b5563",fontWeight:600,letterSpacing:.5,marginBottom:10}}>Reminders for {selected?.name}</div>
                {(reminders||[]).filter(r=>r.leadId===selected?.id).length===0
                  ? <div style={{fontSize:13,color:"#252838"}}>No reminders — click "Reminder" above to add one.</div>
                  : (reminders||[]).filter(r=>r.leadId===selected?.id).map(r=>(
                    <RemRow key={r.id} r={r} today={TODAY} onToggle={toggleRem} onDelete={deleteRem} onViewLead={()=>{}}/>
                  ))
                }
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
  const over  = !r.done && r.dueDate < today;
  const isToday = !r.done && r.dueDate === today;
  return (
    <div className="remrow" style={{background:"#13161f",border:"1px solid #1e2232",borderRadius:9,padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:11,marginBottom:7,opacity:r.done?.6:1,transition:"all .15s"}}>
      <div onClick={()=>onToggle(r.id)} style={{marginTop:2,cursor:"pointer",flexShrink:0}}>
        <div style={{width:17,height:17,borderRadius:4,border:`2px solid ${r.done?"#22c55e":over?"#ef4444":isToday?"#f59e0b":"#252838"}`,background:r.done?"#22c55e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#0c0e14",transition:"all .15s"}}>
          {r.done&&"✓"}
        </div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,color:r.done?"#374151":"#e8e2d5",textDecoration:r.done?"line-through":"none",marginBottom:3}}>{r.text}</div>
        <div style={{display:"flex",gap:12,fontSize:12,flexWrap:"wrap"}}>
          <span style={{color:over?"#ef4444":isToday?"#f59e0b":"#374151"}}>{over?"⚠ Overdue · ":isToday?"● Today · ":""}{r.dueDate}</span>
          {r.leadName&&<span style={{color:"#4b5563"}}>{r.leadName}</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:5,flexShrink:0}}>
        {r.leadId&&<button onClick={()=>onViewLead(r.leadId)} style={{background:"transparent",border:"1px solid #1e2232",borderRadius:6,color:"#4b5563",padding:"3px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>View</button>}
        <button onClick={()=>onDelete(r.id)} style={{background:"transparent",border:"none",color:"#374151",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 4px"}}>×</button>
      </div>
    </div>
  );
}
