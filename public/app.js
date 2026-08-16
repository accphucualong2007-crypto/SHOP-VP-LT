let products=[],settings={},cart=JSON.parse(localStorage.getItem("LT_CART")||"[]");
const money=n=>new Intl.NumberFormat("vi-VN").format(Number(n)||0)+"đ";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
async function api(u,o={}){const r=await fetch(u,o),t=await r.text();let d;try{d=JSON.parse(t)}catch{throw new Error("Server không trả JSON cho "+u+". Hãy xem CMD chạy npm start.")}if(!r.ok)throw new Error(d.error||"Có lỗi");return d}
async function init(){products=await api("/api/products");settings=await api("/api/settings");document.getElementById("shopName").textContent=settings.shopName;document.getElementById("contactInfo").textContent=[settings.contactPhone,settings.contactAddress].filter(Boolean).join(" • ")||"Đặt hàng online mọi lúc, mọi nơi.";renderProducts();updateCartCount()}
function renderProducts(){const q=(document.getElementById("search").value||"").toLowerCase(),a=products.filter(p=>(p.name+" "+p.category).toLowerCase().includes(q));document.getElementById("productsGrid").innerHTML=a.map(p=>`<article class="card"><img src="${esc(p.image)}" onerror="this.src='/uploads/placeholder.svg'"><div class="card-body"><span class="muted">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div class="price">${money(p.price)}</div><p class="muted">${esc(p.description)}</p><div class="sizes">${(p.sizes||[]).map((s,i)=>`<button class="${i===0?"selected":""}" onclick="selectSize(this)">${esc(s)}</button>`).join("")}</div><button class="btn full" onclick="addToCart('${esc(p.id)}',this)">Thêm vào giỏ</button></div></article>`).join("")||"<p>Không có sản phẩm.</p>"}
function selectSize(b){b.parentElement.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")}
function addToCart(id,b){const p=products.find(x=>String(x.id)===String(id)),size=b.closest(".card").querySelector(".sizes .selected")?.textContent||"",old=cart.find(x=>String(x.productId)===String(id)&&x.size===size);old?old.quantity++:cart.push({productId:p.id,size,quantity:1});saveCart();updateCartCount();alert("Đã thêm vào giỏ.")}
function saveCart(){localStorage.setItem("LT_CART",JSON.stringify(cart))}
function updateCartCount(){document.getElementById("cartCount").textContent=cart.reduce((s,x)=>s+x.quantity,0)}
function openCart(){renderCart();document.getElementById("cartModal").classList.remove("hidden")}
function closeCart(){document.getElementById("cartModal").classList.add("hidden")}
function renderCart(){let total=0;document.getElementById("cartItems").innerHTML=cart.map((x,i)=>{const p=products.find(z=>String(z.id)===String(x.productId));if(!p)return"";total+=p.price*x.quantity;return`<div class="cart-line"><div><b>${esc(p.name)}</b><br>Size: ${esc(x.size)}</div><div>${x.quantity} × ${money(p.price)}</div><button onclick="removeCart(${i})">Xóa</button></div>`}).join("")||"<p>Giỏ hàng trống.</p>";document.getElementById("cartTotal").textContent=money(total)}
function removeCart(i){cart.splice(i,1);saveCart();updateCartCount();renderCart()}
function openCheckout(){if(!cart.length)return alert("Giỏ hàng trống.");closeCart();document.getElementById("checkoutModal").classList.remove("hidden")}
function closeCheckout(){document.getElementById("checkoutModal").classList.add("hidden")}
document.getElementById("checkoutForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const btn=e.target.querySelector("button");btn.disabled=true;
 try{
  const r=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer:{name:f.name,phone:f.phone,address:f.address,note:f.note},items:cart,paymentMethod:f.paymentMethod})});
  cart=[];saveCart();updateCartCount();
  let h=`<div class="success"><h3>Đặt hàng thành công!</h3><p>Mã đơn: <b>${esc(r.order.id)}</b></p><p>Tổng: <b>${money(r.order.total)}</b></p><p><a class="btn" href="/track.html">Tra cứu đơn hàng</a></p>`;
  if(r.order.paymentMethod==="VietQR"&&r.order.qrUrl)h+=`<hr><h3>Quét VietQR để thanh toán</h3><img class="qr" src="${esc(r.order.qrUrl)}"><p>Ngân hàng: <b>${esc(r.payment.bankId)}</b></p><p>Số tài khoản: <b>${esc(r.payment.accountNumber)}</b></p><p>Chủ tài khoản: <b>${esc(r.payment.accountName)}</b></p><p>Số tiền: <b>${money(r.payment.amount)}</b></p><button class="btn full" onclick="confirmPayment('${esc(r.order.id)}')">Tôi đã thanh toán</button>`;
  else if(r.order.paymentMethod==="VietQR")h+="<p class=error>Admin chưa cấu hình số tài khoản VietQR.</p>";else h+="<p>Shop sẽ liên hệ xác nhận đơn.</p>";
  h+="</div>";e.target.classList.add("hidden");document.getElementById("result").innerHTML=h;
 }catch(x){alert(x.message)}finally{btn.disabled=false}
});
async function confirmPayment(id){try{await api("/api/orders/"+id+"/payment-confirm",{method:"POST"});alert("Đã ghi nhận. Shop sẽ kiểm tra giao dịch ngân hàng.")}catch(e){alert(e.message)}}
init().catch(e=>alert(e.message));