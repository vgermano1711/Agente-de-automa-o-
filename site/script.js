/* ==========================================================================
   Site 100% estático — sem fetch, sem API, sem banco de dados.
   Tudo aqui roda inteiramente no navegador do visitante.
   ========================================================================== */

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------------------- Cursor customizado --------------------------- */
const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');
const isTouch = window.matchMedia('(hover: none)').matches;

if (!isTouch && cursorDot && cursorRing) {
  let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  function animateRing() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateRing);
  }
  animateRing();

  document.querySelectorAll('a, button, [data-tilt]').forEach((el) => {
    el.addEventListener('mouseenter', () => cursorRing.classList.add('is-active'));
    el.addEventListener('mouseleave', () => cursorRing.classList.remove('is-active'));
  });
}

/* ---------------------------- Barra de progresso ---------------------------- */
const progressFill = document.getElementById('progressFill');
function updateProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  progressFill.style.width = pct + '%';
}

/* ---------------------------- Header: esconder ao rolar ---------------------------- */
const header = document.getElementById('header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const current = window.scrollY;
  header.classList.toggle('is-scrolled', current > 40);

  if (current > lastScroll && current > 200) {
    header.classList.add('is-hidden');
  } else {
    header.classList.remove('is-hidden');
  }
  lastScroll = current;
  updateProgress();
}, { passive: true });

/* ---------------------------- Menu mobile ---------------------------- */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', isOpen);
});

nav.querySelectorAll('.nav__link').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

/* ---------------------------- Link ativo no menu (scrollspy) ---------------------------- */
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav__link');

const spyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { rootMargin: '-45% 0px -45% 0px' });

sections.forEach((s) => spyObserver.observe(s));

/* ---------------------------- Scroll reveal ---------------------------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ---------------------------- Contadores animados ---------------------------- */
const counters = document.querySelectorAll('.stat__num');

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    countObserver.unobserve(el);
  });
}, { threshold: 0.5 });

counters.forEach((el) => countObserver.observe(el));

/* ---------------------------- Tilt nos cards de projeto ---------------------------- */
if (!isTouch) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateY(0) rotateX(0) scale(1)';
    });
  });
}

/* ---------------------------- Botões magnéticos ---------------------------- */
if (!isTouch) {
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
}

/* ---------------------------- Slider de depoimentos ---------------------------- */
const track = document.getElementById('testimonialTrack');
const slides = track.children;
const dotsWrap = document.getElementById('testimonialDots');
let current = 0;

for (let i = 0; i < slides.length; i++) {
  const dot = document.createElement('span');
  if (i === 0) dot.classList.add('is-active');
  dot.addEventListener('click', () => goToSlide(i));
  dotsWrap.appendChild(dot);
}

function goToSlide(index) {
  current = (index + slides.length) % slides.length;
  track.style.transform = `translateX(-${current * 100}%)`;
  [...dotsWrap.children].forEach((dot, i) => dot.classList.toggle('is-active', i === current));
}

document.getElementById('testimonialPrev').addEventListener('click', () => goToSlide(current - 1));
document.getElementById('testimonialNext').addEventListener('click', () => goToSlide(current + 1));

let autoplay = setInterval(() => goToSlide(current + 1), 6000);
track.parentElement.addEventListener('mouseenter', () => clearInterval(autoplay));
track.parentElement.addEventListener('mouseleave', () => {
  autoplay = setInterval(() => goToSlide(current + 1), 6000);
});

/* ---------------------------- Formulário de pedido (sem backend) ----------------------------
   Não existe servidor nem banco de dados aqui: o botão só monta um
   "mailto:" com os dados preenchidos e abre o cliente de e-mail do
   visitante. Os campos (nome, telefone, endereço, pedido) foram
   escolhidos de propósito pra combinar com as tabelas pessoa/endereco/
   pedido em /database — no site real, esse submit viraria um INSERT
   nessas tabelas em vez de um mailto:.
------------------------------------------------------------------------- */
const form = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!name || !phone || !address || !message) {
    formNote.textContent = 'Preenche todos os campos antes de enviar.';
    return;
  }

  const subject = encodeURIComponent(`Pedido pelo site — ${name}`);
  const body = encodeURIComponent(
    `Pedido: ${message}\nEndereço de entrega: ${address}\n\n— ${name} (${phone})`
  );
  // TROQUE AQUI: use o mesmo e-mail do link "contact__email" no HTML
  window.location.href = `mailto:contato@braseiropizzaria.com.br?subject=${subject}&body=${body}`;

  formNote.textContent = 'Abrindo seu cliente de e-mail...';
  form.reset();
});
