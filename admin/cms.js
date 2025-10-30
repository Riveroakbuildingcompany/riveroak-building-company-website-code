(function () {
  const { CMS, React } = window;
  if (!CMS || !React) {
    return;
  }

  const h = React.createElement;

  CMS.registerPreviewStyle("/admin/preview.css");

  const toArray = (value) => (Array.isArray(value) ? value : []);

  const renderStats = (stats) => {
    const entries = [];
    toArray(stats).forEach((stat, index) => {
      if (!stat || (!stat.label && !stat.value)) {
        return;
      }
      entries.push(
        h(
          "dt",
          { key: `stat-label-${index}`, className: "preview-stat-label" },
          stat.label || "Label"
        )
      );
      entries.push(
        h(
          "dd",
          { key: `stat-value-${index}`, className: "preview-stat-value" },
          stat.value || "Value"
        )
      );
    });

    if (entries.length === 0) {
      return null;
    }

    return h("dl", { className: "preview-stats" }, entries);
  };

  const renderTags = (tags) => {
    const items = toArray(tags).map((tag, index) =>
      h(
        "li",
        { key: `tag-${index}`, className: "preview-tag" },
        tag && tag.tag ? tag.tag : tag || "Tag"
      )
    );

    if (items.length === 0) {
      return null;
    }

    return h("ul", { className: "preview-tag-list" }, items);
  };

  const renderParagraphs = (paragraphs) => {
    const items = toArray(paragraphs).map((paragraph, index) => {
      const text = paragraph && (paragraph.text || paragraph.paragraph || paragraph);
      if (!text) {
        return null;
      }
      return h(
        "p",
        { key: `paragraph-${index}`, className: "preview-body" },
        text
      );
    });

    return items.filter(Boolean);
  };

  const renderDetailSections = (details) => {
    const sections = [];
    toArray(details).forEach((detail, index) => {
      if (!detail || (!detail.title && !detail.items)) {
        return;
      }

      const items = toArray(detail.items).map((item, itemIndex) =>
        h("li", { key: `detail-${index}-item-${itemIndex}` }, item && (item.text || item))
      );

      sections.push(
        h(
          "div",
          { key: `detail-${index}`, className: "preview-detail" },
          [
            detail.title &&
              h("h4", { key: "title", className: "preview-subheading" }, detail.title),
            items.length > 0 && h("ul", { key: "list", className: "preview-detail-list" }, items),
          ].filter(Boolean)
        )
      );
    });

    return sections;
  };

  const renderGallery = (gallery) => {
    const items = toArray(gallery.items).map((item, index) => {
      if (!item || (!item.image && !item.caption)) {
        return null;
      }

      const children = [
        item.image &&
          h("img", {
            key: "image",
            src: item.image,
            alt: item.alt || "",
            className: "preview-image",
          }),
        item.caption &&
          h("figcaption", { key: "caption" }, item.caption),
      ].filter(Boolean);

      return h("figure", { key: `gallery-${index}`, className: "preview-gallery-item" }, children);
    });

    if (items.filter(Boolean).length === 0) {
      return null;
    }

    return h("div", { className: "preview-gallery-grid" }, items.filter(Boolean));
  };

  const renderMaterialCards = (cards) => {
    const items = toArray(cards).map((card, index) => {
      if (!card || (!card.title && !card.description)) {
        return null;
      }

      return h(
        "article",
        { key: `card-${index}`, className: "preview-material-card" },
        [
          card.title &&
            h("h4", { key: "title", className: "preview-subheading" }, card.title),
          card.description && h("p", { key: "body" }, card.description),
        ].filter(Boolean)
      );
    });

    return items.filter(Boolean);
  };

  const renderRelatedProjects = (projects) => {
    const items = toArray(projects).map((project, index) => {
      if (!project || (!project.title && !project.summary)) {
        return null;
      }

      return h(
        "article",
        { key: `related-${index}`, className: "preview-related-card" },
        [
          project.image &&
            h("img", {
              key: "image",
              src: project.image,
              alt: project.title || project.summary || "Related project image",
              className: "preview-image",
            }),
          project.title &&
            h("h4", { key: "title", className: "preview-subheading" }, project.title),
          project.summary && h("p", { key: "summary" }, project.summary),
          project.url &&
            h(
              "p",
              { key: "url", className: "preview-link" },
              project.url
            ),
        ].filter(Boolean)
      );
    });

    const filtered = items.filter(Boolean);
    if (filtered.length === 0) {
      return null;
    }

    return h("div", { className: "preview-related-grid" }, filtered);
  };

  const renderLinks = (links) => {
    const items = toArray(links).map((link, index) => {
      if (!link || (!link.label && !link.url)) {
        return null;
      }

      return h(
        "a",
        {
          key: `cta-link-${index}`,
          className: "preview-button",
          href: link.url || "#",
        },
        link.label || link.url
      );
    });

    return items.filter(Boolean);
  };

  const renderDetailLinks = (details) => {
    const groups = [];

    toArray(details).forEach((detail, index) => {
      if (!detail || (!detail.label && !detail.items)) {
        return;
      }

      const entries = toArray(detail.items).map((item, itemIndex) => {
        if (!item) {
          return null;
        }

        const text = item.label || item.text || item.url;
        if (!text) {
          return null;
        }

        return h(
          "span",
          { key: `detail-link-${index}-${itemIndex}`, className: "preview-detail-link" },
          text
        );
      });

      const filtered = entries.filter(Boolean);
      if (filtered.length === 0) {
        return;
      }

      groups.push(
        h(
          "div",
          { key: `detail-group-${index}`, className: "preview-detail-group" },
          [
            detail.label &&
              h("span", { key: "label", className: "preview-detail-label" }, detail.label),
            h("div", { key: "entries", className: "preview-detail-entries" }, filtered),
          ]
        )
      );
    });

    return groups;
  };

  const createSection = (className, key, children) => {
    const content = children.filter(Boolean);
    if (content.length === 0) {
      return null;
    }
    return h("section", { key, className }, content);
  };

  const PortfolioProjectPreview = ({ entry }) => {
    const raw = entry.getIn(["data"]);
    if (!raw) {
      return h("div", { className: "preview-empty" }, "Create or select a project to see the preview.");
    }

    const project = typeof raw.toJS === "function" ? raw.toJS() : raw;

    const hero = project.hero || {};
    const overview = project.overview || {};
    const gallery = project.gallery || {};
    const materials = project.materials || {};
    const related = project.related || {};
    const cta = project.cta || {};

    const sections = [];

    const heroChildren = [
      project.title && h("p", { key: "project-title", className: "preview-project-title" }, project.title),
      hero.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, hero.eyebrow),
      hero.heading && h("h1", { key: "heading", className: "preview-heading" }, hero.heading),
      hero.lede && h("p", { key: "lede", className: "preview-lede" }, hero.lede),
      renderStats(hero.stats),
      renderTags(hero.tags),
      hero.image &&
        h(
          "figure",
          { key: "figure", className: "preview-figure" },
          [
            h("img", {
              key: "image",
              src: hero.image,
              alt: hero.alt || "",
              className: "preview-image",
            }),
            hero.alt && h("figcaption", { key: "alt" }, hero.alt),
          ].filter(Boolean)
        ),
    ];

    sections.push(createSection("preview-section preview-hero", "hero", heroChildren));

    const overviewChildren = [
      overview.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, overview.eyebrow),
      overview.heading && h("h2", { key: "heading", className: "preview-heading" }, overview.heading),
      ...renderParagraphs(overview.paragraphs),
      ...renderDetailSections(overview.details),
    ];

    sections.push(createSection("preview-section", "overview", overviewChildren));

    const galleryChildren = [
      gallery.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, gallery.eyebrow),
      gallery.heading && h("h2", { key: "heading", className: "preview-heading" }, gallery.heading),
      renderGallery(gallery),
    ];

    sections.push(createSection("preview-section", "gallery", galleryChildren));

    const materialChildren = [
      materials.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, materials.eyebrow),
      materials.heading && h("h2", { key: "heading", className: "preview-heading" }, materials.heading),
      materials.body && h("p", { key: "body", className: "preview-body" }, materials.body),
      ...renderMaterialCards(materials.cards || []),
    ];

    sections.push(createSection("preview-section", "materials", materialChildren));

    const relatedChildren = [
      related.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, related.eyebrow),
      related.heading && h("h2", { key: "heading", className: "preview-heading" }, related.heading),
      renderRelatedProjects(related.projects),
    ];

    sections.push(createSection("preview-section", "related", relatedChildren));

    const ctaChildren = [
      cta.eyebrow && h("p", { key: "eyebrow", className: "preview-eyebrow" }, cta.eyebrow),
      cta.heading && h("h2", { key: "heading", className: "preview-heading" }, cta.heading),
      cta.lede && h("p", { key: "lede", className: "preview-body" }, cta.lede),
      ...renderLinks(cta.links),
      ...renderDetailLinks(cta.details),
    ];

    sections.push(createSection("preview-section preview-cta", "cta", ctaChildren));

    const filteredSections = sections.filter(Boolean);

    if (filteredSections.length === 0) {
      return h(
        "div",
        { className: "preview-empty" },
        "Start filling in the fields to see a live preview of your project."
      );
    }

    return h("article", { className: "portfolio-preview-root" }, filteredSections);
  };

  CMS.registerPreviewTemplate("projects", PortfolioProjectPreview);
})();
