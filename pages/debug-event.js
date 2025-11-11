import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function parseToDate(str){
  if(!str) return null;
  if(typeof str === 'string'){
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(str)){
      const [dd,mm,yyyy]=str.split('/').map(Number);
      return new Date(yyyy,mm-1,dd);
    }
    if(/^\d{2}-\d{2}-\d{4}$/.test(str)){
      const [dd,mm,yyyy]=str.split('-').map(Number);
      return new Date(yyyy,mm-1,dd);
    }
    return new Date(str);
  }
  return new Date(str);
}

export default function DebugEvent(){
  const [rows,setRows]=useState([]);
  const [msg,setMsg]=useState('');

  useEffect(()=>{(async()=>{
    try{
      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');
      
      if (!userId || !userEmail) { 
        setMsg('לא מחובר'); 
        return; 
      }
      
      const { data } = await supabase
        .from('events')
        .select('id,status,event_type,event_details,created_at')
        .eq('user_id', userId)
        .order('created_at',{ascending:false})
        .limit(20);
      const today=new Date(); today.setHours(0,0,0,0);
      const mapped=(data||[]).map(ev=>{
        const d=ev.event_details||{};
        const raw=d.end_datetime||d.date||d.start_datetime||null;
        const parsed=parseToDate(raw);
        const parsedDay=parsed? new Date(parsed.getFullYear(),parsed.getMonth(),parsed.getDate()) : null;
        const isPast=parsedDay? parsedDay < today : null;
        return {id:ev.id,status:ev.status,type:ev.event_type,rawDate:raw,parsed:String(parsed),isPast};
      });
      setRows(mapped);
    }catch(e){ console.error(e); setMsg('שגיאה'); }
  })();},[]);

  return (
    <main className="p-6 max-w-4xl mx-auto rtl">
      <h1 className="text-2xl font-bold mb-4">Debug תאריכים</h1>
      {msg && <p className="mb-4 text-red-600">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-right border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">סטטוס</th>
              <th className="p-2 border">סוג</th>
              <th className="p-2 border">Raw</th>
              <th className="p-2 border">Parsed</th>
              <th className="p-2 border">Past?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id}>
                <td className="p-2 border">{r.id}</td>
                <td className="p-2 border">{r.status}</td>
                <td className="p-2 border">{r.type}</td>
                <td className="p-2 border">{String(r.rawDate)}</td>
                <td className="p-2 border">{r.parsed}</td>
                <td className="p-2 border">{r.isPast===null? '-' : (r.isPast? 'Yes' : 'No')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}


