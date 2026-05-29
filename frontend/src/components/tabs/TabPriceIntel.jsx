// ─────────────────────────────────────────────
// BuyerIQ — Price Intelligence Tab (v4.2)
// Changes from v4.1:
//   - Single fetch limit:10000 (no batch loop)
//   - Currency symbols fixed (EUR, GBP, USD)
//   - 3000 shown bug fixed
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { C } from '../../data/theme.js';
import { Card, Heading } from '../ui/Primitives.jsx';
import { fetchRetail } from '../../services/api.js';
import { useData } from '../../context/DataContext.jsx';
import { Package2, Star, Search, Loader2, Tag, ExternalLink, BarChart2, DollarSign } from 'lucide-react';

const ITEMS_PER_PAGE = 48;

const CATEGORIES = [
  { value: 'all',                         label: 'All Wood Products' },
  { value: 'Spoons & Utensils',           label: 'Spoons & Utensils' },
  { value: 'General Wood Kitchenware',    label: 'General Wood' },
  { value: 'Wood Bowls',                  label: 'Wood Bowls' },
  { value: 'Cheese & Charcuterie Boards', label: 'Cheese & Charcuterie' },
  { value: 'Cutting & Chopping Boards',   label: 'Cutting Boards' },
  { value: 'Serving Trays & Platters',    label: 'Serving Trays' },
  { value: 'Mortar & Pestle',             label: 'Mortar & Pestle' },
  { value: 'Wood + Iron Combo',           label: 'Wood + Iron' },
  { value: 'Wood + Marble Combo',         label: 'Wood + Marble' },
  { value: 'Wood + Glass Combo',          label: 'Wood + Glass' },
  { value: 'Wood + Aluminum Combo',       label: 'Wood + Aluminum' },
  { value: 'Wood + Ceramic Combo',        label: 'Wood + Ceramic' },
  { value: 'Wood + Leather Combo',        label: 'Wood + Leather' },
  { value: 'Wood + Resin Combo',          label: 'Wood + Resin' },
  { value: 'Coasters & Trivets',          label: 'Coasters & Trivets' },
  { value: 'Rolling Pins',                 label: 'Rolling Pins' },
  { value: 'Salt & Pepper Mills',         label: 'Salt & Pepper Mills' },
  { value: 'Lazy Susans',                  label: 'Lazy Susans' },
  { value: 'Pizza Peels & Bread Boards',  label: 'Pizza & Bread Boards' },
  { value: 'Knife Blocks & Holders',      label: 'Knife Blocks' },
  
];

const MARKETPLACES = [
  { value: 'all',       label: 'All Platforms' },
  { value: 'amazon',    label: 'Amazon US' },
  { value: 'amazon_uk', label: 'Amazon UK' },
  { value: 'amazon_de', label: 'Amazon DE' },
  { value: 'walmart',   label: 'Walmart' },
  { value: 'amazon_fr', label: 'Amazon FR' },
  { value: 'amazon_ca', label: 'Amazon CA' },
  { value: 'amazon_au', label: 'Amazon AU' },
  { value: 'amazon_jp', label: 'Amazon JP' },
];

const getCurrencySymbol = (currency) => {
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  if (currency === 'JPY') return '¥';
  if (currency === 'CNY') return '¥';
  if (currency === 'CAD') return 'CA$';
  if (currency === 'AUD') return 'A$';
  if (currency === 'INR') return '₹';
  return '$';
};

const getMarketplaceName  = (m) => m === 'walmart' ? 'Walmart' : m === 'amazon_uk' ? 'Amazon UK' : m === 'amazon_de' ? 'Amazon DE' : m === 'amazon_fr' ? 'Amazon FR' : m === 'amazon_ca' ? 'Amazon CA' : m === 'amazon_au' ? 'Amazon AU' : m === 'amazon_jp' ? 'Amazon JP' : 'Amazon';
const getMarketplaceColor = (m) => m === 'walmart' ? '#0071ce' : m === 'amazon_uk' ? '#ff9900' : m === 'amazon_de' ? '#e47911' : m === 'amazon_fr' ? '#00a000' : m === 'amazon_ca' ? '#e47911' : m === 'amazon_au' ? '#f90' : m === 'amazon_jp' ? '#e60012' : '#ff9900';

const selectStyle = (color) => ({
  background:'#1a1a1a', border:'1px solid #333', color,
  padding:'6px 10px', borderRadius:6, fontSize:11, cursor:'pointer', outline:'none',
});

const btnStyle = (active, disabled) => ({
  background: disabled ? '#111' : active ? C.gold : '#1e1e1e',
  border: `1px solid ${active ? C.gold : '#333'}`,
  color: disabled ? '#444' : active ? '#000' : C.muted,
  padding:'7px 12px', borderRadius:6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize:11, fontWeight: active ? 900 : 400,
  minWidth:36, transition:'all 0.15s',
});

const TabPriceIntel = ({ rates }) => {
  const { BUYERS } = useData();

  const [allProducts, setAllProducts] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [totalInDB,   setTotalInDB]   = useState(0);
  const [category,    setCategory]    = useState('all');
  const [marketplace, setMarketplace] = useState('all');
  const [sortBy,      setSortBy]      = useState('price_asc');
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [priceMin,    setPriceMin]    = useState('');
  const [priceMax,    setPriceMax]    = useState('');

  const inrRate = rates ? (rates.INR || rates.inr || 84) : 84;

  // Single fetch — no batch loop
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    (async () => {
      try {
        const params = { limit: 20000, sort_by: 'scraped_at', sort_order: 'desc' };
        if (marketplace !== 'all') params.marketplace = marketplace;
        const res = await fetchRetail(params);
        const all = res?.data || [];
        const total = res?.total || res?.pagination?.total || all.length;
        if (!cancelled) {
          setAllProducts(all);
          setTotalInDB(total);
        }
      } catch { if (!cancelled) setAllProducts([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [marketplace]);

  const filteredProducts = useMemo(() => {
    let r = category === 'all' ? allProducts : allProducts.filter(p => (p.category || '') === category);
    if (search) r = r.filter(p => (p.product_title||'').toLowerCase().includes(search.toLowerCase()));
    if (priceMin) r = r.filter(p => parseFloat(p.price||0) >= parseFloat(priceMin));
    if (priceMax) r = r.filter(p => parseFloat(p.price||0) <= parseFloat(priceMax));
    return [...r].sort((a,b) => {
      if (sortBy === 'price_asc')  return parseFloat(a.price||0) - parseFloat(b.price||0);
      if (sortBy === 'price_desc') return parseFloat(b.price||0) - parseFloat(a.price||0);
      if (sortBy === 'rating')     return parseFloat(b.rating||0) - parseFloat(a.rating||0);
      if (sortBy === 'reviews')    return (b.review_count||0) - (a.review_count||0);
      return 0;
    });
  }, [allProducts, category, sortBy, search, priceMin, priceMax]);

  const totalPages        = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((page-1)*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE);

  const prices = filteredProducts.map(p => {
  const raw = parseFloat(p.price||0);
  if (!raw) return 0;
  if (p.currency === 'JPY') return raw / (rates?.JPY || 158.91);
  if (p.currency === 'EUR') return raw / (rates?.EUR || 0.85);
  if (p.currency === 'GBP') return raw / (rates?.GBP || 0.74);
  if (p.currency === 'AUD') return raw / (rates?.AUD || 1.40);
  if (p.currency === 'CAD') return raw / (rates?.CAD || 1.37);
  return raw;
}).filter(x => x > 0);
  const avgPrice  = prices.length ? (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2) : '—';
  const minPrice  = prices.length ? Math.min(...prices).toFixed(2) : '—';
  const maxPrice  = prices.length ? Math.max(...prices).toFixed(2) : '—';
  const ratings   = filteredProducts.map(p => parseFloat(p.rating||0)).filter(x => x > 0);
  const avgRating = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—';
  const impliedFOB = avgPrice !== '—' ? (parseFloat(avgPrice)/3).toFixed(2) : '—';


  const handleCategory    = v => { setCategory(v);    setPage(1); };
  const handleSort        = v => { setSortBy(v);       setPage(1); };
  const handleMarketplace = v => { setMarketplace(v); setPage(1); };

  const pageButtons = () => {
    let start = Math.max(1, page-3);
    let end   = Math.min(totalPages, start+6);
    if (end-start < 6) start = Math.max(1, end-6);
    return Array.from({length: end-start+1}, (_,i) => start+i);
  };

  return (
    <div>
      <Heading sub="Live retail prices, margin analysis & FOB ranges" badge="L">Price Intelligence</Heading>

      {rates && (
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center',padding:'10px 16px',borderRadius:10,background:C.green+'08',border:`1px solid ${C.green}25`,fontSize:11}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:C.green}}/>
          <span style={{color:C.green,fontWeight:700}}>Live Rates Active</span>
          <span style={{color:C.muted}}>·</span>
          <span style={{color:C.muted}}>
            $/₹ {(rates.INR||rates.inr)?.toFixed(2)} &nbsp;·&nbsp;
            €/₹ {((rates.INR||rates.inr)/(rates.EUR||rates.eur))?.toFixed(2)} &nbsp;·&nbsp;
            £/₹ {((rates.INR||rates.inr)/(rates.GBP||rates.gbp))?.toFixed(2)}
          </span>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:16,fontWeight:900,color:C.text}}>Live Marketplace Prices</span>
          {loading
            ? <span style={{background:'#333',color:C.muted,fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700}}>Loading...</span>
            : <span style={{background:C.green+'25',color:C.green,fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700}}>
                {filteredProducts.length.toLocaleString()} shown · {totalInDB.toLocaleString()} total in DB
              </span>
          }
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
            placeholder="Search products..."
            style={{background:'#1a1a1a',border:'1px solid #333',color:C.text,padding:'6px 10px',borderRadius:6,fontSize:11,outline:'none',width:160}}
          />
          <input
            value={priceMin} onChange={e=>{setPriceMin(e.target.value);setPage(1);}}
            placeholder="Min $"
            style={{background:'#1a1a1a',border:'1px solid #333',color:C.text,padding:'6px 10px',borderRadius:6,fontSize:11,outline:'none',width:70}}
            type="number"
          />
          <input
            value={priceMax} onChange={e=>{setPriceMax(e.target.value);setPage(1);}}
            placeholder="Max $"
            style={{background:'#1a1a1a',border:'1px solid #333',color:C.text,padding:'6px 10px',borderRadius:6,fontSize:11,outline:'none',width:70}}
            type="number"
          />
          <select value={marketplace} onChange={e=>handleMarketplace(e.target.value)} style={selectStyle(C.blue)}>
            {MARKETPLACES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={category} onChange={e=>handleCategory(e.target.value)} style={selectStyle(C.gold)}>
            {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={sortBy} onChange={e=>handleSort(e.target.value)} style={selectStyle(C.muted)}>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating">Best Rated</option>
            <option value="reviews">Most Reviewed</option>
          </select>
        </div>
      </div>

      {!loading && filteredProducts.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:10,marginBottom:18}}>
          {[
            {label:'Avg Retail Price', val:`$${avgPrice}`,  sub:'Filtered set',   color:C.green},
            {label:'Min Price',        val:`$${minPrice}`,  sub:'Cheapest',       color:C.blue},
            {label:'Max Price',        val:`$${maxPrice}`,  sub:'Premium',        color:C.gold},
            {label:'Avg Rating',       val:`★ ${avgRating}`,sub:'Customer score',color:C.amber},
            {label:'Implied FOB (÷3)', val:`$${impliedFOB}`,sub:'Your target',    color:'#e040fb'},
            {label:'FOB in ₹',         val:`₹${impliedFOB!=='—'?(parseFloat(impliedFOB)*inrRate).toFixed(0):'—'}`,sub:'At live rates',color:'#ff9933'},
          ].map(s=>(
            <div key={s.label} style={{padding:'12px 14px',borderRadius:12,background:s.color+'0a',border:`1px solid ${s.color}20`,textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:900,color:s.color,lineHeight:1.2}}>{s.val}</div>
              <div style={{fontSize:11,color:C.text,fontWeight:700,marginTop:4}}>{s.label}</div>
              <div style={{fontSize:9,color:C.muted,marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Card style={{textAlign:'center',padding:60,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Loader2 size={32} color={C.muted} strokeWidth={1.5} style={{animation:"spin 1s linear infinite"}}/></div>
          <div style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:8}}>Loading products...</div>
          <div style={{color:C.muted,fontSize:12}}>Fetching from database</div>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card style={{textAlign:'center',padding:60,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Search size={32} color={C.muted} strokeWidth={1.5}/></div>
          <div style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:8}}>No products found</div>
          <div style={{color:C.muted,fontSize:12}}>Try a different category or marketplace filter</div>
        </Card>
      ) : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(215px,1fr))',gap:12,marginBottom:20}}>
            {paginatedProducts.map((p,i) => {
              const price  = parseFloat(p.price||0);
              const toUSD = (amt, cur) => {
       if (cur === 'EUR') return amt / (rates?.EUR || 0.85);
      if (cur === 'GBP') return amt / (rates?.GBP || 0.74);
     if (cur === 'AUD') return amt / (rates?.AUD || 1.40);
     if (cur === 'CAD') return amt / (rates?.CAD || 1.37);
    if (cur === 'JPY') return amt / (rates?.JPY || 158.91);
  return amt;
};
const priceUSD = toUSD(price, p.currency);
              const fob    = (priceUSD/3).toFixed(2);
              const fobInr = Math.round(priceUSD/3*inrRate);
              const catLabel = p.category || 'Wood Product';
              const currSymbol = getCurrencySymbol(p.currency);

              return (
                <div key={p.id||i}
                  onClick={()=> p.product_url && window.open(p.product_url,'_blank')}
                  style={{borderRadius:14,background:'#111',border:'1px solid #222',overflow:'hidden',cursor:p.product_url?'pointer':'default',transition:'all 0.2s',display:'flex',flexDirection:'column'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#444';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px #00000060';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#222';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                >
                  <div style={{width:'100%',height:150,background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.product_title||'Product'} style={{maxWidth:'100%',maxHeight:150,objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>
                      : <Package2 size={36} color={C.muted} strokeWidth={1}/>
                    }
                    <span style={{position:'absolute',top:8,right:8,background:getMarketplaceColor(p.marketplace),color:'#fff',fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,letterSpacing:0.4}}>
                      {getMarketplaceName(p.marketplace).toUpperCase()}
                    </span>
                    <span style={{position:'absolute',top:8,left:8,background:'#00000090',color:C.green,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {catLabel.length > 22 ? catLabel.slice(0,20)+'…' : catLabel}
                    </span>
                  </div>

                  <div style={{padding:12,flex:1,display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.text,lineHeight:1.4,height:48,overflow:'hidden'}}>
                      {p.product_title||'Wood Product'}
                    </div>
                    {p.brand && p.brand !== 'undefined' && (
                      <div style={{fontSize:10,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {p.brand}
                      </div>
                    )}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                      <span style={{fontSize:22,fontWeight:900,color:price > 0 ? C.green : C.red,lineHeight:1}}>
                        {price > 0 ? `${currSymbol}${price.toFixed(2)}` : 'N/A'}
                      </span>
                      <div style={{textAlign:'right'}}>
                        {p.rating > 0 && <div style={{fontSize:11,color:C.amber,fontWeight:700}}>★ {parseFloat(p.rating).toFixed(1)}</div>}
                        {p.review_count > 0 && <div style={{fontSize:9,color:C.muted}}>{Number(p.review_count).toLocaleString()} reviews</div>}
                      </div>
                    </div>
                    {price > 0 && (
                      <div style={{padding:'7px 10px',borderRadius:8,background:C.green+'08',border:`1px solid ${C.green}15`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:10,color:C.muted}}>Est. FOB (÷3)</span>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontSize:13,fontWeight:900,color:C.green}}>${fob}</span>
                          {rates && <span style={{fontSize:10,color:'#ff9933',fontWeight:700}}>₹{fobInr}</span>}
                        </div>
                      </div>
                    )}
                    {p.product_url && (
                      <div style={{fontSize:9,color:C.muted,textAlign:'center'}}>
                        View on {getMarketplaceName(p.marketplace)} →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginBottom:24,flexWrap:'wrap'}}>
              <button onClick={()=>setPage(1)} disabled={page===1} style={btnStyle(false, page===1)}>«</button>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{...btnStyle(false,page===1),padding:'7px 14px',fontWeight:600}}>‹ Prev</button>
              {pageButtons().map(n=>(
                <button key={n} onClick={()=>setPage(n)} style={btnStyle(page===n, false)}>{n}</button>
              ))}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{...btnStyle(false,page===totalPages),padding:'7px 14px',fontWeight:600}}>Next ›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={btnStyle(false,page===totalPages)}>»</button>
              <span style={{color:C.muted,fontSize:11,marginLeft:4}}>
                Page {page} of {totalPages} · {filteredProducts.length.toLocaleString()} products
              </span>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default TabPriceIntel;
