-- NHBF Gadget: initial Supabase schema
-- Run this in the Supabase SQL editor.
-- Never place a service_role/secret key in index.html.

create extension if not exists pgcrypto;

do $$ begin
  create type public.order_status as enum ('Processing', 'Confirmed', 'Shipped', 'Received', 'Cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text default '',
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= price),
  image_url text,
  category text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  division text not null,
  district text not null,
  thana text not null,
  address text not null,
  shipping_charge numeric(12,2) not null default 130,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'Cash on delivery',
  transaction_id text,
  status public.order_status not null default 'Processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  image_url text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Helper: only authenticated users whose profile role is admin can manage all data.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "public can read active products" on public.products
  for select using (is_active = true or public.is_admin());
create policy "admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "customers read own orders" on public.orders
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "customers create orders" on public.orders
  for insert with check (customer_id = auth.uid() or customer_id is null);
create policy "admins update orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy "customers read own order items" on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );
create policy "customers create order items" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or o.customer_id is null))
  );

create policy "users manage own profile" on public.profiles
  for all using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Automatically create a customer profile after Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- After creating your own Auth user, promote it manually:
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';      const whyBestModal = document.getElementById('why-best-modal');
      if(whyBestBtn) whyBestBtn.addEventListener('click', () => whyBestModal.classList.remove('hidden'));
      document.getElementById('close-why-best').addEventListener('click', () => whyBestModal.classList.add('hidden'));
      document.getElementById('why-best-ok-btn').addEventListener('click', () => whyBestModal.classList.add('hidden'));

      const checkoutModal = document.getElementById('checkout-modal');
      const closeCheckout = document.getElementById('close-checkout');
      const buyNowButtons = document.querySelectorAll('.buy-now-btn');

      const modalImg = document.getElementById('modal-item-img');
      const modalTitle = document.getElementById('modal-item-title');
      const modalPrice = document.getElementById('modal-item-price');
      const qtyInput = document.getElementById('modal-qty-input');
      const qtyPlus = document.getElementById('modal-qty-plus');
      const qtyMinus = document.getElementById('modal-qty-minus');
      const qtyPlusInline = document.getElementById('modal-qty-plus-inline');
      const qtyMinusInline = document.getElementById('modal-qty-minus-inline');
      const qtyDisplay = document.getElementById('modal-qty-display');
      const checkoutColor = document.getElementById('checkout-color');
      const subtotalEl = document.getElementById('summary-subtotal');
      const totalEl = document.getElementById('summary-total');
      const checkoutForm = document.getElementById('checkout-form');
      const successModal = document.getElementById('success-modal');
      const closeSuccessBtn = document.getElementById('close-success-btn');
      const submitOrderBtn = document.getElementById('submit-order-btn');

      const paymentRadios = document.querySelectorAll('input[name="Payment Method"]');
      const advancePaymentBox = document.getElementById('advance-payment-box');
      const custTrxidInput = document.getElementById('cust-trxid');

      paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.value === 'Full Advance Payment') {
            advancePaymentBox.classList.remove('hidden');
            custTrxidInput.setAttribute('required', 'required');
          } else {
            advancePaymentBox.classList.add('hidden');
            custTrxidInput.removeAttribute('required');
          }
        });
      });

      let currentUnitPrice = 0;
      let currentCartOrder = null;

      function syncOrderStatusToAdmin(userOrder, status) {
        if (!userOrder) return;
        try {
          const adminOrders = JSON.parse(localStorage.getItem(ADMIN_ORDERS_KEY)) || [];
          const profile = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
          const matchingOrder = adminOrders.find(order => {
            // Prefer the unique ID; the fallback keeps older orders compatible.
            if (userOrder.orderId && order.orderId) {
              return order.orderId === userOrder.orderId;
            }
            return order.name === userOrder.title &&
              order.phone === profile.phone &&
              order.status !== 'Cancelled';
          });
          if (matchingOrder) {
            matchingOrder.status = status;
            localStorage.setItem(ADMIN_ORDERS_KEY, JSON.stringify(adminOrders));
          }
        } catch (error) {
          console.warn('Order status sync failed:', error);
        }
      }

      function openCheckoutWithData(name, price, img, cartItems = null) {
        loadUserProfile();
        currentCartOrder = Array.isArray(cartItems) && cartItems.length ? cartItems : null;
        currentUnitPrice = parseFloat(price) || 0;

        const isK8Earbuds = name === 'K8 Wireless Earbuds High-Fidelity Stereo Bass Ultra-Long Battery Life';
        checkoutColor.innerHTML = isK8Earbuds
          ? '<option value="সাদা">সাদা</option><option value="কালো">কালো</option><option value="হলুদ">হলুদ</option>'
          : '<option value="Random Color">Random Color</option>';
        if (!districtSelect.value) shippingSelect.value = '130';
        const cartTotal = currentCartOrder
          ? currentCartOrder.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0)
          : currentUnitPrice;
        modalTitle.innerText = currentCartOrder
          ? `কার্টের ${currentCartOrder.length}টি পণ্য`
          : name;
        modalPrice.innerText = cartTotal + '৳';
        modalImg.src = img;
        qtyInput.value = currentCartOrder ? 1 : 1;
        qtyDisplay.innerText = '1';

        const codRadio = document.querySelector('input[name="Payment Method"][value="Cash on delivery"]');
        if (codRadio) {
          codRadio.checked = true;
          advancePaymentBox.classList.add('hidden');
          custTrxidInput.removeAttribute('required');
          custTrxidInput.value = '';
        }

        updateCalculations();
        checkoutModal.classList.remove('hidden');
      }

      function updateCalculations() {
        const qty = parseInt(qtyInput.value) || 1;
        const subtotal = currentCartOrder
          ? currentCartOrder.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0)
          : currentUnitPrice * qty;
        const shipping = parseInt(shippingSelect.value) || 0;
        subtotalEl.innerText = subtotal + '৳';
        totalEl.innerText = (subtotal + shipping) + '৳';
      }

      buyNowButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const card = btn.closest('.product-card');
          openCheckoutWithData(card.dataset.name, card.dataset.price, card.dataset.img);
        });
      });

      // Lightweight cart stored locally until a server-side cart is added.
      const CART_KEY = 'nhbf_cart_items';
      const WISHLIST_KEY = 'nhbf_wishlist_items';
      const wishlistModal = document.getElementById('wishlist-modal');
      const wishlistList = document.getElementById('wishlist-list');
      const wishlistCount = document.getElementById('wishlist-count');
      const wishlistItemCount = document.getElementById('wishlist-item-count');
      function getWishlist() {
        try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
        catch (error) { return []; }
      }
      function saveWishlist(items) { localStorage.setItem(WISHLIST_KEY, JSON.stringify(items)); }
      function renderWishlist() {
        const items = getWishlist();
        wishlistCount.textContent = items.length;
        wishlistItemCount.textContent = `${items.length}টি পণ্য`;
        wishlistList.innerHTML = items.length ? items.map((item, index) => `
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-2xl border border-gray-100">
            <img src="${item.img}" alt="${item.name}" class="w-14 h-14 object-cover rounded-xl border">
            <div class="min-w-0 flex-1"><p class="text-xs font-bold line-clamp-2">${item.name}</p><p class="text-xs text-blue-600 font-bold mt-1">${item.price}৳</p></div>
            <button class="wishlist-buy-btn bg-blue-600 text-white text-[10px] font-bold px-2.5 py-2 rounded-xl" data-index="${index}">Buy</button>
            <button class="remove-wishlist-btn text-red-500 px-1" data-index="${index}" aria-label="পছন্দের তালিকা থেকে সরান">✕</button>
          </div>`).join('') : '<div class="text-center py-12 text-gray-400 text-xs"><i class="fa-regular fa-heart text-3xl mb-2 block"></i>পছন্দের তালিকায় এখনো কোনো পণ্য নেই</div>';
      }
      function toggleWishlist(card, button) {
        const items = getWishlist();
        const index = items.findIndex(item => item.id === card.dataset.name);
        if (index >= 0) { items.splice(index, 1); button.classList.remove('text-pink-500'); button.classList.add('text-gray-400'); showToast('পছন্দের তালিকা থেকে সরানো হয়েছে'); }
        else { items.push({ id: card.dataset.name, name: card.dataset.name, price: Number(card.dataset.price) || 0, img: card.dataset.img }); button.classList.remove('text-gray-400'); button.classList.add('text-pink-500'); showToast('পছন্দের তালিকায় যোগ হয়েছে'); }
        saveWishlist(items); renderWishlist();
      }
      const cartModal = document.getElementById('cart-modal');
      const cartList = document.getElementById('cart-list');
      const cartCount = document.getElementById('cart-count');
      const cartSubtotal = document.getElementById('cart-subtotal');
      const cartItemCount = document.getElementById('cart-item-count');
      const toastMessage = document.getElementById('toast-message');
      let toastTimer;

      function getCart() {
        try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
        catch (error) { return []; }
      }
      function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
      function showToast(message) {
        toastMessage.textContent = message;
        toastMessage.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastMessage.classList.add('hidden'), 2200);
      }
      function renderCart() {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        cartCount.textContent = totalItems;
        cartItemCount.textContent = `${totalItems}টি পণ্য`;
        cartSubtotal.textContent = `${subtotal}৳`;
        cartList.innerHTML = cart.length ? cart.map((item, index) => `
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-2xl border border-gray-100">
            <img src="${item.img}" alt="${item.name}" class="w-14 h-14 object-cover rounded-xl border">
            <div class="min-w-0 flex-1"><p class="text-xs font-bold line-clamp-2">${item.name}</p><p class="text-xs text-blue-600 font-bold mt-1">${item.price}৳</p></div>
            <div class="flex items-center gap-1"><button class="cart-qty-btn w-6 h-6 rounded bg-white border" data-index="${index}" data-change="-1">−</button><span class="text-xs font-bold w-5 text-center">${item.qty}</span><button class="cart-qty-btn w-6 h-6 rounded bg-blue-600 text-white" data-index="${index}" data-change="1">+</button></div>
            <button class="remove-cart-btn text-red-500 px-1" data-index="${index}" aria-label="পণ্য সরান">✕</button>
          </div>`).join('') : '<div class="text-center py-12 text-gray-400 text-xs"><i class="fa-solid fa-cart-shopping text-3xl mb-2 block"></i>কার্টে এখনো কোনো পণ্য নেই</div>';
      }
      function addToCart(card) {
        const cart = getCart();
        const product = { id: card.dataset.name, name: card.dataset.name, price: Number(card.dataset.price) || 0, img: card.dataset.img };
        const existing = cart.find(item => item.id === product.id);
        if (existing) existing.qty += 1; else cart.push({ ...product, qty: 1 });
        saveCart(cart); renderCart(); showToast('✅ কার্টে পণ্য যোগ হয়েছে');
      }
      document.querySelectorAll('.product-card').forEach(card => {
        const buyButton = card.querySelector('.buy-now-btn');
        if (!buyButton) return;
        const wishlistButton = document.createElement('button');
        wishlistButton.type = 'button';
        wishlistButton.className = 'wishlist-btn absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/95 text-gray-400 shadow flex items-center justify-center';
        wishlistButton.innerHTML = '<i class="fa-regular fa-heart"></i>';
        const isSaved = getWishlist().some(item => item.id === card.dataset.name);
        if (isSaved) { wishlistButton.classList.remove('text-gray-400'); wishlistButton.classList.add('text-pink-500'); }
        wishlistButton.addEventListener('click', () => toggleWishlist(card, wishlistButton));
        card.appendChild(wishlistButton);
        const cartButton = document.createElement('button');
        cartButton.type = 'button';
        cartButton.className = 'add-to-cart-btn w-full mt-2 border border-blue-600 text-blue-600 hover:bg-blue-50 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1';
        cartButton.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Add to Cart';
        cartButton.addEventListener('click', () => addToCart(card));
        buyButton.parentNode.insertBefore(cartButton, buyButton);
      });
      cartList.addEventListener('click', (event) => {
        const qtyButton = event.target.closest('.cart-qty-btn');
        const removeButton = event.target.closest('.remove-cart-btn');
        const cart = getCart();
        if (qtyButton) {
          const item = cart[Number(qtyButton.dataset.index)];
          item.qty = Math.max(0, item.qty + Number(qtyButton.dataset.change));
          saveCart(cart.filter(item => item.qty > 0)); renderCart();
        }
        if (removeButton) { cart.splice(Number(removeButton.dataset.index), 1); saveCart(cart); renderCart(); }
      });
      document.getElementById('open-cart-btn').addEventListener('click', () => { renderCart(); cartModal.classList.remove('hidden'); });
      document.getElementById('close-cart-modal').addEventListener('click', () => cartModal.classList.add('hidden'));
      document.getElementById('open-wishlist-btn').addEventListener('click', () => { renderWishlist(); wishlistModal.classList.remove('hidden'); });
      document.getElementById('close-wishlist-modal').addEventListener('click', () => wishlistModal.classList.add('hidden'));
      wishlistList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.remove-wishlist-btn');
        const buyButton = event.target.closest('.wishlist-buy-btn');
        const items = getWishlist();
        if (removeButton) { items.splice(Number(removeButton.dataset.index), 1); saveWishlist(items); renderWishlist(); return; }
        if (buyButton) { const item = items[Number(buyButton.dataset.index)]; if (item) { wishlistModal.classList.add('hidden'); openCheckoutWithData(item.name, item.price, item.img); } }
      });
      renderWishlist();
      document.getElementById('clear-cart-btn').addEventListener('click', () => { saveCart([]); renderCart(); showToast('কার্ট খালি করা হয়েছে'); });
      document.getElementById('cart-checkout-btn').addEventListener('click', () => {
        const cart = getCart();
        if (!cart.length) return showToast('কার্টে আগে পণ্য যোগ করুন');
        cartModal.classList.add('hidden');
        const first = cart[0];
        openCheckoutWithData(first.name, first.price, first.img, cart);
      });
      document.querySelectorAll('img.product-img, .category-card img, .shop-dialog-item img').forEach(img => {
        img.loading = 'lazy';
        img.decoding = 'async';
      });
      renderCart();

      document.querySelectorAll('.buy-now-from-modal, .buy-now-from-shop-dialog').forEach(btn => {
        btn.addEventListener('click', () => {
          bestPriceModal.classList.add('hidden');
          shopDialogModal.classList.add('hidden');
          openCheckoutWithData(btn.dataset.name, btn.dataset.price, btn.dataset.img);
        });
      });

      window.addEventListener('click', (e) => {
        if (e.target === checkoutModal) checkoutModal.classList.add('hidden');
        if (e.target === whyBestModal) whyBestModal.classList.add('hidden');
        if (e.target === bestPriceModal) bestPriceModal.classList.add('hidden');
        if (e.target === shopDialogModal) shopDialogModal.classList.add('hidden');
        if (e.target === quickViewModal) {
          quickViewModal.classList.add('hidden');
          quickViewModal.classList.remove('quickview-fullscreen');
        }
        if (e.target === accountModal) accountModal.classList.add('hidden');
        if (e.target === successModal) successModal.classList.add('hidden');
        if (e.target === receivedConfirmModal) receivedConfirmModal.classList.add('hidden');
      });

      closeCheckout.addEventListener('click', () => checkoutModal.classList.add('hidden'));
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.fixed:not(.hidden)').forEach(modal => {
          if (modal.id !== 'menu-drawer') modal.classList.add('hidden');
        });
        document.getElementById('shareModal')?.classList.remove('active');
      });
      closeSuccessBtn.addEventListener('click', () => {
        successModal.classList.add('hidden');
        window.location.href = '#'; 
      });

      function increaseQuantity() {
        qtyInput.value = parseInt(qtyInput.value) + 1;
        qtyDisplay.innerText = qtyInput.value;
        updateCalculations();
      }

      function decreaseQuantity() {
        if (parseInt(qtyInput.value) > 1) {
          qtyInput.value = parseInt(qtyInput.value) - 1;
          qtyDisplay.innerText = qtyInput.value;
          updateCalculations();
        }
      }

      // Quantity controls use the inline minus/number/plus buttons in the checkout.
      if (qtyPlus) qtyPlus.addEventListener('click', increaseQuantity);
      if (qtyMinus) qtyMinus.addEventListener('click', decreaseQuantity);
      if (qtyPlusInline) qtyPlusInline.addEventListener('click', increaseQuantity);
      if (qtyMinusInline) qtyMinusInline.addEventListener('click', decreaseQuantity);

      shippingSelect.addEventListener('change', updateCalculations);

      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitOrderBtn.disabled) return;

        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const address = document.getElementById('cust-address').value;
        const division = document.getElementById('cust-division').value;
        const district = document.getElementById('cust-district').value;
        const thana = document.getElementById('cust-thana').value;
        const shipping = shippingSelect.value;
        const qty = qtyInput.value;
        const productTitle = currentCartOrder
          ? currentCartOrder.map(item => `${item.name} × ${item.qty}`).join(' | ')
          : modalTitle.innerText;
        const total = totalEl.innerText;
        const paymentRadio = document.querySelector('input[name="Payment Method"]:checked');
        const paymentMethod = paymentRadio ? paymentRadio.value : 'Cash on delivery';
        const trxId = custTrxidInput.value.trim();

        if (paymentMethod === 'Full Advance Payment' && !trxId) {
          alert('⚠️ অনুগ্রহ করে Transaction ID (TrxID) প্রদান করুন।');
          return;
        }

        document.getElementById('form-product-title').value = productTitle;
        document.getElementById('form-product-qty').value = qty;
        document.getElementById('form-product-color').value = document.getElementById('checkout-color')?.value || 'সাধারণ';
        document.getElementById('form-division').value = division;
        document.getElementById('form-district').value = district;
        document.getElementById('form-thana').value = thana;
        document.getElementById('form-shipping-charge').value = shipping + '৳';
        document.getElementById('form-total-price').value = total;

        submitOrderBtn.disabled = true;
        submitOrderBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সাবমিট হচ্ছে...`;

        try {
          const formData = new FormData(checkoutForm);
          const response = await fetch(checkoutForm.action, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });

          if (!response.ok) {
            throw new Error(`Order submission failed: ${response.status}`);
          }
        } catch (error) {
          console.error("Formspree Submission Error:", error);
          submitOrderBtn.disabled = false;
          submitOrderBtn.innerHTML = `<span>Place Order</span>`;
          alert('❌ অর্ডার পাঠানো যায়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
          return;
        }

        const userProfile = { name, phone, address };
        localStorage.setItem(USER_KEY, JSON.stringify(userProfile));

        const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
        const orderId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newOrder = {
          orderId: orderId,
          title: productTitle,
          qty: qty,
          total: total,
          status: 'Processing',
          division: division,
          district: district,
          thana: thana,
          shipping: shipping,
          date: new Date().toLocaleDateString('bn-BD')
        };
        orders.unshift(newOrder);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

        // Keep the owner sales report synchronized with confirmed orders.
        if (typeof window.saveNewOrder === 'function') {
          const orderSubtotal = currentCartOrder
            ? currentCartOrder.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0)
            : currentUnitPrice * (parseInt(qty) || 1);
          window.saveNewOrder(productTitle, String(orderSubtotal), modalImg.src, district, division, {
            orderId: orderId,
            customerName: name,
            phone: phone,
            address: address,
            thana: thana,
            qty: qty,
            shipping: shipping,
            paymentMethod: paymentMethod
          });
        }

        // WhatsApp Link for Advance Payment
        const wsContainer = document.getElementById('whatsapp-screenshot-container');
        const wsLink = document.getElementById('whatsapp-screenshot-link');
        
        if (paymentMethod === 'Full Advance Payment') {
            const msg = encodeURIComponent(`Hello NHBF Gadget, I paid advance for order: ${productTitle}. TrxID: ${trxId}`);
            wsLink.href = `https://wa.me/8801404852352?text=${msg}`;
            wsContainer.classList.remove('hidden');
        } else {
            wsContainer.classList.add('hidden');
        }

        submitOrderBtn.disabled = false;
        submitOrderBtn.innerHTML = `<span>Place Order</span>`;
        checkoutModal.classList.add('hidden');
        checkoutForm.reset();
        if (currentCartOrder) {
          saveCart([]);
          renderCart();
          currentCartOrder = null;
        }

        successModal.classList.remove('hidden');
      });

      // Side Drawer Mechanics
      const drawer = document.getElementById('menu-drawer');
      const panel = document.getElementById('drawer-panel');
      const openBtn = document.getElementById('open-menu-btn');
      const closeBtn = document.getElementById('close-menu-btn');
      const backdrop = document.getElementById('menu-backdrop');
      const drawerProfileBtn = document.getElementById('drawer-profile-btn');

      function openDrawer(){
        drawer.classList.remove('hidden');
        setTimeout(()=>{ panel.classList.remove('-translate-x-full'); }, 10);
        document.body.style.overflow = 'hidden';
      }
      function closeDrawer(){
        panel.classList.add('-translate-x-full');
        setTimeout(()=>{ drawer.classList.add('hidden'); document.body.style.overflow=''; }, 300);
      }

      if(openBtn) openBtn.addEventListener('click', openDrawer);
      if(closeBtn) closeBtn.addEventListener('click', closeDrawer);
      if(backdrop) backdrop.addEventListener('click', closeDrawer);
      if(drawerProfileBtn) {
        drawerProfileBtn.addEventListener('click', () => {
            closeDrawer();
            openAccountModal();
        });
      }

      // Category Popup Logic
      let activeCategory = null;
      const catModal = document.getElementById('category-modal');
      const catList = document.getElementById('category-products-list');
      const catTitle = document.getElementById('cat-title-text');
      const catImg = document.getElementById('cat-modal-img');

      function openCategoryModal(category, catName, catImageSrc){
        const allProducts = document.querySelectorAll('.product-card');
        catList.innerHTML = '';
        catTitle.innerText = catName;
        catImg.src = catImageSrc || 'https://i.ibb.co.com/qLWvG5KJ/gadget-2025-10-29-69011dbb876b4.webp';
        let found = 0;
        const standardCategories = ['earbuds', 'neckband', 'powerbank', 'charger', 'smartwatch', 'smart-watch', 'watch'];

        allProducts.forEach(p => {
          const productCategories = (p.dataset.category || '').toLowerCase().split(/\s+/).filter(Boolean);
          const isSmartGadget = category.toLowerCase() === 'smart-gadget';
          const matchesCategory = isSmartGadget
            ? !productCategories.some(productCategory => standardCategories.includes(productCategory))
            : productCategories.includes(category.toLowerCase());

          if(matchesCategory){
            found++;
            const div = document.createElement('div');
            div.className = 'bg-white rounded-2xl p-2 border shadow-sm flex flex-col justify-between';
            div.innerHTML = `
              <div>
                <img src="${p.dataset.img}" class="w-full h-28 object-cover rounded-xl mb-2">
                <h4 class="text-[11px] font-bold line-clamp-2 leading-snug">${p.dataset.name}</h4>
              </div>
              <div>
                <p class="text-blue-600 font-bold text-sm mt-1">${p.dataset.price}৳</p>
                <button class="buy-from-cat w-full mt-2 bg-blue-600 text-white text-[11px] font-bold py-1.5 rounded-xl transition hover:bg-blue-700" data-name="${p.dataset.name}" data-price="${p.dataset.price}" data-img="${p.dataset.img}">Buy Now</button>
              </div>
            `;
            catList.appendChild(div);
          }
        });

        if(found === 0){
          catList.innerHTML = `<div class="col-span-2 text-center py-12 text-gray-400"><i class="fa-solid fa-box-open text-3xl mb-3 block"></i><p class="text-xs">${catName} ক্যাটাগরিতে এখনো কোনো পণ্য যোগ করা হয়নি</p></div>`;
        }

        catModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        catList.querySelectorAll('.buy-from-cat').forEach(btn=>{
          btn.addEventListener('click', e=>{
            const d = e.target.dataset;
            openCheckoutWithData(d.name, d.price, d.img);
            catModal.classList.add('hidden');
          });
        });
      }

      function closeCategoryModal(){
        catModal.classList.add('hidden');
        document.body.style.overflow = '';
        activeCategory = null;
        document.querySelectorAll('.category-card div').forEach(d=>d.classList.remove('ring-2','ring-blue-600'));
      }

      document.querySelectorAll('.category-card, .category-btn').forEach(card=>{
        card.addEventListener('click', ()=>{
          const cat = card.dataset.category;
          const catName = card.dataset.catname || cat;
          const catImageSrc = card.querySelector('img') ? card.querySelector('img').src : '';

          if(activeCategory === cat){
            closeCategoryModal();
          } else {
            activeCategory = cat;
            document.querySelectorAll('.category-card div').forEach(d=>d.classList.remove('ring-2','ring-blue-600'));
            if(card.querySelector('div')) card.querySelector('div').classList.add('ring-2','ring-blue-600');
            if(drawer) closeDrawer();
            openCategoryModal(cat, catName, catImageSrc);
          }
        });
      });

      document.getElementById('close-category-modal').onclick = closeCategoryModal;
      document.getElementById('close-cat-footer').onclick = closeCategoryModal;
      document.getElementById('category-backdrop').onclick = closeCategoryModal;
      
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');
  const productGrid = document.getElementById('product-grid');
  const noResultId = 'no-search-result';
  const categoryFilter = document.getElementById('product-category-filter');
  const sortSelect = document.getElementById('product-sort');
  const resetFiltersBtn = document.getElementById('reset-product-filters');
  const resultCount = document.getElementById('product-result-count');

  function getDiscountPercent(product) {
    const price = Number(product.dataset.price) || 0;
    const oldPrice = Number(product.dataset.oldprice) || 0;
    return oldPrice > price ? ((oldPrice - price) / oldPrice) * 100 : 0;
  }

  function sortProducts() {
    // The first .grid inside product-grid is the filter controls grid.
    // Target the actual product grid so sorting never moves the filters.
    const grid = [...productGrid.children].find(child =>
      child.classList.contains('grid') && child.querySelector('.product-card')
    );
    if (!grid) return;
    const products = [...grid.children].filter(child => child.classList.contains('product-card'));
    const sortType = sortSelect.value;

    products.sort((a, b) => {
      if (sortType === 'price-low') return Number(a.dataset.price || 0) - Number(b.dataset.price || 0);
      if (sortType === 'price-high') return Number(b.dataset.price || 0) - Number(a.dataset.price || 0);
      if (sortType === 'discount') return getDiscountPercent(b) - getDiscountPercent(a);
      if (sortType === 'name') return (a.dataset.name || '').localeCompare(b.dataset.name || '', 'bn');
      return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
    });
    products.forEach(product => grid.appendChild(product));
  }

  function applyProductFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value.toLowerCase();
    const grid = [...productGrid.children].find(child =>
      child.classList.contains('grid') && child.querySelector('.product-card')
    );
    const products = grid ? [...grid.children].filter(child => child.classList.contains('product-card')) : [];
    const oldNoResult = document.getElementById(noResultId);
    if (oldNoResult) oldNoResult.remove();

    if (query) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');

    let found = 0;
    products.forEach(product => {
      const name = (product.dataset.name || '').toLowerCase();
      const categories = (product.dataset.category || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
      const price = product.dataset.price || '';
      const matchesSearch = !query || name.includes(query) || categories.join(' ').includes(query) || price.includes(query);
      const matchesCategory = selectedCategory === 'all' || categories.includes(selectedCategory);
      const visible = matchesSearch && matchesCategory;
      product.style.display = visible ? 'flex' : 'none';
      if (visible) found++;
    });

    resultCount.textContent = `${found}টি পণ্য দেখা যাচ্ছে`;
    if (!found && grid) {
      const msg = document.createElement('div');
      msg.id = noResultId;
      msg.className = 'col-span-2 md:col-span-3 lg:col-span-4 text-center py-12 text-gray-400';
      msg.innerHTML = `<i class="fa-solid fa-box-open text-3xl mb-3 block"></i><p class="text-xs">কোনো পণ্য পাওয়া যায়নি</p>`;
      grid.appendChild(msg);
    }
  }

  document.querySelectorAll('.product-card').forEach((product, index) => {
    product.dataset.originalIndex = index;
  });

  function doSearch(){
    sortProducts();
    applyProductFilters();
  }

  function clearSearch(){
    searchInput.value = '';
    doSearch();
  }

  // টাইপ করলেই সার্চ হবে
  searchInput.addEventListener('input', doSearch);
  searchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') doSearch();
  });
  clearBtn.addEventListener('click', clearSearch);
  categoryFilter.addEventListener('change', doSearch);
  sortSelect.addEventListener('change', doSearch);
  resetFiltersBtn.addEventListener('click', () => {
    categoryFilter.value = 'all';
    sortSelect.value = 'default';
    clearSearch();
    sortProducts();
  });
  sortProducts();
  doSearch();
  
  (function(){
  var OWNER_EMAIL = 'mdnajmulhasan4709@gmail.com';
  var ORDERS_KEY = 'parvez_all_orders_v4';
  var VIEW_KEY = 'parvez_views_total_v4';
  var TODAY_VIEW_KEY = 'parvez_views_' + new Date().toDateString();
  var VISITED_KEY = 'parvez_has_visited';
  var NEW_KEY = 'parvez_new_count_v4';
  var OLD_KEY = 'parvez_old_count_v4';

  function el(id){ return document.getElementById(id); }

  function updateViews(){
    var total = parseInt(localStorage.getItem(VIEW_KEY)||'0')+1;
    localStorage.setItem(VIEW_KEY, total);
    var today = parseInt(localStorage.getItem(TODAY_VIEW_KEY)||'0')+1;
    localStorage.setItem(TODAY_VIEW_KEY, today);

    var hasVisited = localStorage.getItem(VISITED_KEY);
    if(!hasVisited){
      var newCount = parseInt(localStorage.getItem(NEW_KEY)||'0')+1;
      localStorage.setItem(NEW_KEY, newCount);
      localStorage.setItem(VISITED_KEY, 'true');
    } else {
      var oldCount = parseInt(localStorage.getItem(OLD_KEY)||'0')+1;
      localStorage.setItem(OLD_KEY, oldCount);
    }

    if(el('total-views')) el('total-views').innerText = total;
    if(el('today-views')) el('today-views').innerText = today;
    if(el('new-visitors')) el('new-visitors').innerText = localStorage.getItem(NEW_KEY)||'0';
    if(el('old-visitors')) el('old-visitors').innerText = localStorage.getItem(OLD_KEY)||'0';
  }
  updateViews();

  function loadSales(){
    var orders=[]; try{orders=JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]');}catch(e){}
    var todayStr=new Date().toDateString(), m=new Date().getMonth(), y=new Date().getFullYear();
    var ts=0,tc=0,ms=0,mc=0,ys=0,yc=0, map={}, districts={}, processing=0, received=0, cancelled=0;
    for(var i=0;i<orders.length;i++){
      var o=orders[i], d=new Date(o.date), isReceived=o.status === 'Received', p=isReceived ? (parseInt(o.price)||0) : 0;
      if(o.status === 'Received') received++; else if(o.status === 'Cancelled') cancelled++; else processing++;
      if(!isReceived) continue;
      var district = o.district || 'জেলা উল্লেখ নেই';
      if(!districts[district]) districts[district] = {count:0, total:0};
      districts[district].count += parseInt(o.qty)||1; districts[district].total += p;
      if(d.toDateString()===todayStr){ts+=p; tc++;}
      if(d.getMonth()===m && d.getFullYear()===y){ms+=p; mc++;}
      if(d.getFullYear()===y){ys+=p; yc++;}
      if(!map[o.name]) map[o.name]={count:0,total:0,img:o.img};
      map[o.name].count += parseInt(o.qty)||1; map[o.name].total+=p;
    }
    if(el('today-sales')) el('today-sales').innerText=ts+'৳';
    if(el('today-count')) el('today-count').innerText=tc+' টি';
    if(el('month-sales')) el('month-sales').innerText=ms+'৳';
    if(el('month-count')) el('month-count').innerText=mc+' টি';
    if(el('year-sales')) el('year-sales').innerText=ys+'৳';
    if(el('year-count')) el('year-count').innerText=yc+' টি';
    if(el('processing-orders')) el('processing-orders').innerText = processing;
    if(el('received-orders')) el('received-orders').innerText = received;
    if(el('cancelled-orders')) el('cancelled-orders').innerText = cancelled;

    var districtDiv=el('district-analysis');
    var districtKeys=Object.keys(districts).sort(function(a,b){ return districts[b].count-districts[a].count; });
    if(districtKeys.length===0){
      districtDiv.innerHTML='<p class="text-[11px] text-gray-400 text-center py-3">এখনো জেলা-ভিত্তিক অর্ডার নেই</p>';
    } else {
      districtDiv.innerHTML=districtKeys.map(function(name){
        var data=districts[name];
        return '<div class="flex items-center justify-between bg-indigo-50 p-2 rounded-xl"><div><p class="text-[11px] font-bold text-gray-800">'+name+'</p><p class="text-[10px] text-gray-500">'+data.count+' টি অর্ডার</p></div><p class="text-[11px] font-bold text-indigo-600">'+data.total+'৳</p></div>';
      }).join('');
    }

    var div=el('product-analysis');
    var keys=Object.keys(map);
    if(keys.length===0){ div.innerHTML='<p class="text-[11px] text-gray-400 text-center py-3">এখনো কোনো সফল বিক্রয় নেই</p>'; }
    else{
      div.innerHTML='';
      for(var k=0;k<keys.length;k++){
        var name=keys[k], data=map[name];
        div.innerHTML+='<div class="flex items-center gap-2 bg-gray-50 p-2 rounded-xl"><img src="'+(data.img||'')+'" class="w-10 h-10 rounded-lg object-cover"><div class="flex-1"><p class="text-[11px] font-bold">'+name+'</p><p class="text-[10px] text-gray-500">'+data.count+' পিস বিক্রি</p></div><div class="text-right"><p class="text-[11px] font-bold text-blue-600">'+data.total+'৳</p></div></div>';
      }
    }

    window.salesReportData = { products: map, districts: districts };
    renderSalesReport();
  }

  window.saveNewOrder=function(name,price,img,district,division,details){
    var orders=[]; try{orders=JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]');}catch(e){}
    details = details || {};
    orders.push({
      orderId: details.orderId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name:name, price:price, img:img, district:district||'জেলা উল্লেখ নেই', division:division||'',
      customerName:details.customerName||'তথ্য নেই', phone:details.phone||'তথ্য নেই',
      address:details.address||'তথ্য নেই', thana:details.thana||'তথ্য নেই', qty:details.qty||'1',
      shipping:details.shipping||'130', paymentMethod:details.paymentMethod||'Cash on delivery',
      status:'Processing', date:new Date().toISOString()
    });
    localStorage.setItem(ORDERS_KEY,JSON.stringify(orders));
  };

  async function checkPassword(){
    var client = window.__nhbfSupabase;
    var passError = el('pass-error');
    if (!client || !client.auth) {
      passError.innerText = 'Supabase client পাওয়া যায়নি।';
      passError.classList.remove('hidden');
      return;
    }

    var result = await client.auth.getSession();
    var user = result.data && result.data.session && result.data.session.user;
    if (user && (user.email || '').toLowerCase() === OWNER_EMAIL) {
      el('secret-pass-panel').classList.add('hidden');
      el('secret-admin-panel').classList.remove('hidden');
      loadSales(); updateViews();
      passError.classList.add('hidden');
    } else {
      passError.innerText = user
        ? 'এই Supabase account দিয়ে Owner Dashboard ব্যবহার করা যাবে না।'
        : 'আগে Supabase owner account দিয়ে লগইন করুন।';
      passError.classList.remove('hidden');
      if(navigator.vibrate) navigator.vibrate([100,50,100]);
    }
  }

  el('pass-submit').onclick = checkPassword;
  el('close-pass-panel').onclick = function(){ el('secret-pass-panel').classList.add('hidden'); };

  var logo=document.querySelector('header img,.logo, header h1, header');
  var pressTimer=null;
  if(logo){
    function startPress(e){
      pressTimer=setTimeout(function(){
        el('secret-pass-panel').classList.remove('hidden');
        setTimeout(function(){ el('secret-pass-input').focus(); },100);
        if(navigator.vibrate) navigator.vibrate(200);
      }, 3000);
    }
    function cancelPress(){ clearTimeout(pressTimer); }
    logo.addEventListener('mousedown', startPress);
    logo.addEventListener('touchstart', startPress, {passive:false});
    logo.addEventListener('mouseup', cancelPress);
    logo.addEventListener('mouseleave', cancelPress);
    logo.addEventListener('touchend', cancelPress);
  }

  el('close-secret-panel').onclick=function(){ el('secret-admin-panel').classList.add('hidden'); };
  el('secret-bg').onclick=function(){ el('secret-admin-panel').classList.add('hidden'); };
  el('reset-sales').onclick=function(){ if(confirm('সব ডাটা ডিলিট করবে?')){ localStorage.removeItem(ORDERS_KEY); localStorage.removeItem(VIEW_KEY); localStorage.removeItem(NEW_KEY); localStorage.removeItem(OLD_KEY); localStorage.removeItem(TODAY_VIEW_KEY); loadSales(); updateViews(); } };

  // আলাদা স্ট্যাটাস বাটনে চাপলে অর্ডারের পূর্ণ তথ্য দেখানো হবে।
  var adminOrdersModal = el('admin-orders-modal');
  var adminOrdersList = el('admin-orders-list');
  var adminOrdersTitle = el('admin-orders-title');
  function openAdminOrders(status, title) {
    var orders=[]; try{ orders=JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]'); }catch(e){}
    var filtered = orders.filter(function(order){ return (order.status || 'Processing') === status; });
    adminOrdersTitle.innerText = title + ' (' + filtered.length + ')';
    if(!filtered.length){
      adminOrdersList.innerHTML='<div class="text-center py-12 text-gray-400 text-xs"><i class="fa-solid fa-box-open text-3xl mb-2 block"></i>এই তালিকায় কোনো অর্ডার নেই</div>';
    } else {
      adminOrdersList.innerHTML=filtered.map(function(order, index){
        return '<div class="bg-gray-50 border rounded-2xl p-3 space-y-2">' +
          '<div class="flex gap-3"><img src="'+(order.img||'')+'" class="w-14 h-14 rounded-xl object-cover border">' +
          '<div class="min-w-0 flex-1"><p class="text-xs font-bold text-gray-800">'+(order.name||'পণ্য')+'</p>' +
          '<p class="text-[11px] text-gray-700 mt-1">👤 '+(order.customerName||'তথ্য নেই')+'</p>' +
          '<p class="text-[11px] text-gray-500">📞 '+(order.phone||'তথ্য নেই')+'</p></div></div>' +
          '<div class="text-[11px] text-gray-600 leading-relaxed border-t pt-2">📍 '+(order.division||'')+' / '+(order.district||'')+' / '+(order.thana||'')+'<br>🏠 '+(order.address||'তথ্য নেই')+'<br>📦 পরিমাণ: '+(order.qty||1)+' | 💰 মূল্য: '+(order.price||0)+'৳ | 🚚 চার্জ: '+(order.shipping||0)+'৳<br>💳 '+(order.paymentMethod||'Cash on delivery')+' | 🕒 '+new Date(order.date).toLocaleString('bn-BD')+'</div>' +
          (status === 'Processing' ? '<div class="flex gap-2 pt-1"><button class="admin-deliver-btn flex-1 bg-emerald-600 text-white text-[11px] font-bold py-2 rounded-xl" data-index="'+orders.indexOf(order)+'">✅ সম্পূর্ণ</button><button class="admin-cancel-btn flex-1 bg-red-600 text-white text-[11px] font-bold py-2 rounded-xl" data-index="'+orders.indexOf(order)+'">❌ বাতিল</button></div>' : '') +
          '</div>';
      }).join('');
    }
    adminOrdersModal.classList.remove('hidden');
  }
  function changeAdminOrderStatus(index, status){
    var orders=[]; try{orders=JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]');}catch(e){}
    var adminOrder = orders[index];
    if(adminOrder){
      adminOrder.status=status;
      localStorage.setItem(ORDERS_KEY,JSON.stringify(orders));
      try {
        var userOrders = JSON.parse(localStorage.getItem('nhbf_user_orders') || '[]');
        userOrders.forEach(function(userOrder){
          var sameOrder = adminOrder.orderId && userOrder.orderId === adminOrder.orderId;
          var legacyMatch = !adminOrder.orderId && userOrder.title === adminOrder.name && userOrder.qty == adminOrder.qty;
          if(sameOrder || legacyMatch) userOrder.status = status;
        });
        localStorage.setItem('nhbf_user_orders', JSON.stringify(userOrders));
      } catch(e) {}
      loadSales();
    }
    var title = status === 'Received' ? 'ডেলিভারি সম্পূর্ণ' : 'ডেলিভারি ক্যানসেল';
    openAdminOrders(status, title);
  }
  el('processing-orders-btn').onclick=function(){openAdminOrders('Processing','ডেলিভারি প্রসেসিং');};
  el('received-orders-btn').onclick=function(){openAdminOrders('Received','ডেলিভারি সম্পূর্ণ');};
  el('cancelled-orders-btn').onclick=function(){openAdminOrders('Cancelled','ডেলিভারি ক্যানসেল');};
  el('close-admin-orders').onclick=function(){adminOrdersModal.classList.add('hidden');};
  el('admin-orders-backdrop').onclick=function(){adminOrdersModal.classList.add('hidden');};
  adminOrdersList.addEventListener('click', function(e){
    var deliver=e.target.closest('.admin-deliver-btn'), cancel=e.target.closest('.admin-cancel-btn');
    if(deliver) changeAdminOrderStatus(Number(deliver.dataset.index),'Received');
    if(cancel && confirm('এই অর্ডারটি ক্যানসেল করতে চান?')) changeAdminOrderStatus(Number(cancel.dataset.index),'Cancelled');
  });

  var salesReportModal = el('sales-report-modal');
  var salesReportList = el('sales-report-list');
  var salesReportTitle = el('sales-report-title');
  function renderSalesReport(){
    if(!salesReportList || !window.salesReportData) return;
    var data = window.salesReportData;
    var products = data.products || {}, districts = data.districts || {};
    var mode = salesReportModal.dataset.mode || 'products';
    var source = mode === 'districts' ? districts : products;
    var keys = Object.keys(source).sort(function(a,b){ return source[b].count-source[a].count; });
    salesReportList.innerHTML = keys.length ? keys.map(function(name){
      var item=source[name];
      return '<div class="flex items-center justify-between bg-gray-50 border border-gray-100 p-3 rounded-2xl"><div><p class="text-xs font-bold text-gray-800">'+name+'</p><p class="text-[10px] text-gray-500">'+item.count+' টি প্রোডাক্ট বিক্রি</p></div><p class="text-xs font-bold text-blue-600">'+item.total+'৳</p></div>';
    }).join('') : '<p class="text-center py-12 text-xs text-gray-400">এখনো কোনো সফল বিক্রয় নেই</p>';
  }
  function openSalesReport(mode){
    salesReportModal.dataset.mode=mode;
    salesReportTitle.innerText=mode === 'districts' ? 'জেলা ভিত্তিক বিক্রয়' : 'বিক্রয়কৃত প্রোডাক্ট';
    renderSalesReport();
    salesReportModal.classList.remove('hidden');
  }
  el('sold-products-btn').onclick=function(){openSalesReport('products');};
  el('district-sales-btn').onclick=function(){openSalesReport('districts');};
  el('close-sales-report').onclick=function(){salesReportModal.classList.add('hidden');};
  el('sales-report-backdrop').onclick=function(){salesReportModal.classList.add('hidden');};
})();


document.addEventListener('DOMContentLoaded', function() {
  const track = document.getElementById('main-banner-track');
  const dots = document.querySelectorAll('.banner-dot');
  let currentIndex = 0;
  const totalSlides = 3;
  let autoSlide;

  function goToSlide(index) {
    currentIndex = index;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    dots.forEach((dot, i) => {
      if (i === currentIndex) {
        dot.classList.remove('opacity-50','w-2.5');
        dot.classList.add('opacity-100','w-6');
      } else {
        dot.classList.add('opacity-50','w-2.5');
        dot.classList.remove('opacity-100','w-6');
      }
    });
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % totalSlides;
    goToSlide(currentIndex);
  }

  function startAutoSlide() {
    autoSlide = setInterval(nextSlide, 5000);
  }
  function stopAutoSlide() {
    clearInterval(autoSlide);
  }

  dots.forEach(dot => {
    dot.addEventListener('click', function() {
      stopAutoSlide();
      goToSlide(parseInt(this.dataset.index));
      startAutoSlide();
    });
  });

  goToSlide(0);
  startAutoSlide();
});


let currentCard = null;

function openShareModal(button) {
  currentCard = button.closest('.product-card');
  document.getElementById('shareModal').classList.add('active');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('active');
}

// Build a clean URL without keeping the current page's old query parameters.
function getProductShareUrl(card) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('sp_name', card.dataset.name || '');
  url.searchParams.set('sp_price', card.dataset.price || '');
  url.searchParams.set('sp_oldprice', card.dataset.oldprice || '');
  url.searchParams.set('sp_desc', card.dataset.desc || '');
  url.searchParams.set('sp_img', card.dataset.img || '');
  return url.toString();
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(input);
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
    const copied = document.execCommand('copy');
    input.remove();
    copied ? resolve() : reject(new Error('Copy failed'));
  });
}

function shareTo(type) {
  if (!currentCard) return;

  const name = currentCard.dataset.name || '';
  const price = currentCard.dataset.price || '';
  const url = getProductShareUrl(currentCard);
  const text = `🔥 ${name} - মাত্র ${price}৳\nঅর্ডার করুন: ${url}`;

  if (type === 'copy') {
    copyText(url).then(
      () => {
        closeShareModal();
        alert('✅ শেয়ার লিংক কপি হয়েছে!');
      },
      () => alert(`লিংক কপি করা যায়নি। নিচের লিংকটি কপি করুন:\n\n${url}`)
    );
    return;
  }

  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  closeShareModal();

  if (type === 'whatsapp') window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  if (type === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
  if (type === 'messenger') window.open(`fb-messenger://share/?link=${encodedUrl}`, '_blank');
}

function shareProduct(button) {
  const card = button.closest('.product-card');
  const url = getProductShareUrl(card);
  copyText(url).then(
    () => alert('✅ প্রোডাক্টের শেয়ার লিংক কপি হয়েছে!'),
    () => alert(`লিংক কপি করা যায়নি। নিচের লিংকটি কপি করুন:\n\n${url}`)
  );
}

  // Shared links open a dedicated product page instead of reordering the home grid.
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const sharedName = (params.get('sp_name') || '').trim();
  if (!sharedName) return;

  document.body.classList.add('shared-product-page');
  document.body.style.overflow = 'hidden';

  const cards = [...document.querySelectorAll('.product-card')];
  const sharedCard = cards.find(card =>
    (card.dataset.name || '').trim() === sharedName
  );

  const product = sharedCard ? {
    name: sharedCard.dataset.name || sharedName,
    price: sharedCard.dataset.price || params.get('sp_price') || '',
    oldprice: sharedCard.dataset.oldprice || params.get('sp_oldprice') || '',
    desc: sharedCard.dataset.desc || params.get('sp_desc') || '',
    img: sharedCard.dataset.img || params.get('sp_img') || ''
  } : {
    name: sharedName,
    price: params.get('sp_price') || '',
    oldprice: params.get('sp_oldprice') || '',
    desc: params.get('sp_desc') || '',
    img: params.get('sp_img') || ''
  };

  document.getElementById('modalTitle').innerText = product.name;
  document.getElementById('modalPrice').innerText = product.price ? `${product.price}৳` : '';
  document.getElementById('modalOldPrice').innerText = product.oldprice ? `${product.oldprice}৳` : '';
  document.getElementById('modalDesc').innerText = product.desc || 'এই প্রোডাক্ট সম্পর্কে বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
  document.getElementById('modalImg').src = product.img;

  const strip = document.getElementById('shared-products-strip');
  const otherCards = cards.filter(card => card !== sharedCard);
  strip.innerHTML = otherCards.map(card => `
    <div class="shared-product-slide bg-slate-50 rounded-2xl border border-gray-100 p-2 flex flex-col">
      <img src="${card.dataset.img}" alt="${card.dataset.name}" class="w-full h-24 object-cover rounded-xl">
      <p class="text-[10px] font-bold line-clamp-2 mt-2 flex-1">${card.dataset.name}</p>
      <p class="text-xs font-bold text-blue-600 mt-1">${card.dataset.price}৳</p>
      <button type="button" class="shared-strip-buy mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1.5 rounded-lg" data-name="${card.dataset.name}" data-price="${card.dataset.price}" data-img="${card.dataset.img}">Buy Now</button>
    </div>`).join('');

  const slideAmount = () => Math.max(1, strip.clientWidth * (window.innerWidth < 768 ? .5 : .25));
  const slideStrip = direction => strip.scrollBy({left: direction * slideAmount(), behavior:'smooth'});
  document.getElementById('shared-products-prev').onclick = () => slideStrip(-1);
  document.getElementById('shared-products-next').onclick = () => slideStrip(1);
  strip.querySelectorAll('.shared-strip-buy').forEach(button => {
    button.addEventListener('click', () => {
      closeSharedModal();
      openCheckoutWithData(button.dataset.name, button.dataset.price, button.dataset.img);
    });
  });

  let imageScale = 1, imageX = 0, imageY = 0, dragging = false, startX = 0, startY = 0;
  let pinchStartDistance = 0, pinchStartScale = 1;
  const imageWrap = document.getElementById('shared-image-wrap');
  const sharedImage = document.getElementById('modalImg');
  function updateImageTransform(){ sharedImage.style.transform = `translate(${imageX}px,${imageY}px) scale(${imageScale})`; }
  imageWrap.addEventListener('wheel', e => { e.preventDefault(); imageScale = Math.min(4, Math.max(1, imageScale + (e.deltaY < 0 ? .2 : -.2))); updateImageTransform(); }, {passive:false});
  imageWrap.addEventListener('pointerdown', e => { dragging=true; startX=e.clientX-imageX; startY=e.clientY-imageY; imageWrap.setPointerCapture(e.pointerId); });
  imageWrap.addEventListener('pointermove', e => { if(!dragging) return; imageX=e.clientX-startX; imageY=e.clientY-startY; updateImageTransform(); });
  imageWrap.addEventListener('pointerup', () => dragging=false);
  imageWrap.addEventListener('pointercancel', () => dragging=false);
  imageWrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      dragging = false;
      pinchStartDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchStartScale = imageScale;
    }
  }, {passive:false});
  imageWrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      imageScale = Math.min(4, Math.max(1, pinchStartScale * distance / pinchStartDistance));
      updateImageTransform();
    }
  }, {passive:false});

  let autoSlideTimer = setInterval(() => slideStrip(1), 3500);
  const pauseAutoSlide = () => { clearTimeout(autoSlideTimer); autoSlideTimer = setTimeout(() => { autoSlideTimer = setInterval(() => slideStrip(1), 3500); }, 5000); };
  ['pointerdown','touchstart','wheel'].forEach(eventName => strip.addEventListener(eventName, pauseAutoSlide, {passive:true}));
  strip.addEventListener('pointerdown', e => {
    const start = e.clientX, initial = strip.scrollLeft;
    const move = event => { strip.scrollLeft = initial - (event.clientX - start); };
    const stop = () => { strip.removeEventListener('pointermove', move); strip.removeEventListener('pointerup', stop); };
    strip.addEventListener('pointermove', move);
    strip.addEventListener('pointerup', stop, {once:true});
  });

  document.getElementById('sharedProductModal').classList.remove('hidden');

  document.getElementById('shared-buy-btn').onclick = () => {
    closeSharedModal();
    openCheckoutWithData(product.name, product.price, product.img);
    document.getElementById('form-product-color').value = document.getElementById('checkout-color').value;
    updateCalculations();
  };

  document.getElementById('shared-home-btn').onclick = () => {
    window.location.href = window.location.pathname;
  };
});

function closeSharedModal() {
  document.getElementById('sharedProductModal').classList.add('hidden');
  document.body.classList.remove('shared-product-page');
  document.body.style.overflow = '';
}
</script>
    <script src="auth-profile.js"></script>
</body>
</html>
