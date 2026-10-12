const PRODUCTS = [
  {id:"armaf-club-de-nuit-milestone", name:"Armaf Club de Nuit Milestone", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-untold", name:"Armaf Club de Nuit Untold", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-intense-man-edt", name:"Armaf Club de Nuit Intense Man (EDT)", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-intense-man-extrait-de-parfum", name:"Armaf Club de Nuit Intense Man Extrait de Parfum", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-intense-man-limited-edition-parfum", name:"Armaf Club de Nuit Intense Man Limited Edition Parfum", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-urban-man", name:"Armaf Club de Nuit Urban Man", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-urban-man-elixir", name:"Armaf Club de Nuit Urban Man Elixir", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-iconic", name:"Armaf Club de Nuit Iconic", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-intense-sillage", name:"Armaf Club de Nuit Intense Sillage", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-club-de-nuit-intense-overdose", name:"Armaf Club de Nuit Intense Overdose", brand:"Armaf", line:"Club de Nuit", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-tropical-collection", name:"Armaf Odyssey Tropical Collection", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-homme", name:"Armaf Odyssey Homme", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-limoni", name:"Armaf Odyssey Limoni", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-spectra", name:"Armaf Odyssey Spectra", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-wild-one-gold-edition", name:"Armaf Odyssey Wild One Gold Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-mandarin-sky-elixir-limited-edition", name:"Armaf Odyssey Mandarin Sky Elixir Limited Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-go-mango", name:"Armaf Odyssey Go Mango", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-mandarin-sky-limited-edition", name:"Armaf Odyssey Mandarin Sky Limited Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-mega-limited-edition", name:"Armaf Odyssey Mega Limited Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-aoud", name:"Armaf Odyssey Aoud", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-tyrant-special-edition", name:"Armaf Odyssey Tyrant Special Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-homme-white-edition", name:"Armaf Odyssey Homme White Edition", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-eau-de-montagne-mountain", name:"Armaf Odyssey Eau de Montagne Mountain", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-aqua", name:"Armaf Odyssey Aqua", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-artisto", name:"Armaf Odyssey Artisto", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-candee-woman", name:"Armaf Odyssey Candee - Woman", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-soda-pop", name:"Armaf Odyssey Soda Pop", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-revolution", name:"Armaf Odyssey Revolution", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-nexus", name:"Armaf Odyssey nexus", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"armaf-odyssey-dubai-chocolate", name:"Armaf Odyssey Dubai chocolate", brand:"Armaf", line:"Odyssey", mono:"A", blurb:"Middle Eastern powerhouse \u2014 bold, long-lasting, compliment magnets.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"absolute-noir-eau-de-parfum", name:"Absolute Noir Eau de Parfum", brand:"Absolute", line:null, mono:"A", blurb:"Absolute essentials \u2014 pure and direct.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"absolute-ice-eau-de-parfum", name:"Absolute Ice Eau de Parfum", brand:"Absolute", line:null, mono:"A", blurb:"Absolute essentials \u2014 pure and direct.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-noir", name:"Afnan Supremacy Noir", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-incense", name:"Afnan Supremacy Incense", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-gold", name:"Afnan Supremacy Gold", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-oud", name:"Afnan Supremacy Oud", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy", name:"Afnan Supremacy", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-in-heaven", name:"Afnan Supremacy In Heaven", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-not-only-intense", name:"Afnan Supremacy Not Only Intense", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-supremacy-collector-s-edition", name:"Afnan Supremacy Collector's Edition", brand:"Afnan", line:"Supremacy", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-rare-reef", name:"Afnan Rare Reef", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-turathi-electric", name:"Afnan Turathi Electric", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-turathi-turathi", name:"Afnan Turathi Turathi", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"9pm", name:"9pm", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-night-out", name:"Afnan Night Out", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-rebel", name:"Afnan Rebel", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-elixer", name:"Afnan Elixer", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-dive", name:"Afnan Dive", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-original", name:"Afnan original", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"afnan-yellow", name:"Afnan Yellow", brand:"Afnan", line:"Essentials", mono:"A", blurb:"Cult-favorite house behind some of the most hyped scents on the internet.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-azul", name:"Rayhaan Azul", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-aloha", name:"Rayhaan Aloha", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-obsidian", name:"Rayhaan Obsidian", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-aquatica", name:"Rayhaan Aquatica", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-terra", name:"Rayhaan Terra", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-elixir", name:"Rayhaan Elixir", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-crimson", name:"Rayhaan Crimson", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-italia", name:"Rayhaan Italia", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-jungle-vibe", name:"Rayhaan jungle Vibe", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-lion", name:"Rayhaan Lion", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-ocean-rush", name:"Rayhaan Ocean Rush", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-tropical-vibe", name:"Rayhaan Tropical Vibe", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-pharaoh", name:"Rayhaan Pharaoh", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-imperia", name:"Rayhaan Imperia", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-adonis-icarus", name:"Rayhaan Adonis Icarus", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-cal-cologne-edition", name:"Rayhaan Cal Cologne Edition", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-aura", name:"Rayhaan Aura", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-wolf", name:"Rayhaan wolf", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-giza", name:"Rayhaan Giza", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rayhaan-pacific", name:"Rayhaan Pacific", brand:"Rayhaan", line:null, mono:"R", blurb:"Fresh, modern Arabian perfumery with serious projection.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-ice", name:"RASASI Hawas Ice", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-black", name:"RASASI Hawas Black", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-malibu", name:"RASASI Hawas Malibu", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-london", name:"RASASI Hawas London", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-atlantis", name:"RASASI Hawas Atlantis", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-fire", name:"RASASI Hawas Fire", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-kobra", name:"RASASI Hawas Kobra", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-elixir", name:"RASASI Hawas Elixir", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-original", name:"RASASI Hawas Original", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-tropical", name:"RASASI Hawas Tropical", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-overdose", name:"RASASI Hawas Overdose", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-viper", name:"RASASI Hawas Viper", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-highness", name:"RASASI Hawas Highness", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-nautilus", name:"RASASI Hawas Nautilus", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-sapphire", name:"RASASI Hawas Sapphire", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-chrome", name:"RASASI Hawas Chrome", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-verde", name:"RASASI Hawas verde", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-gold-digger", name:"RASASI Hawas Gold Digger", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-la-mer", name:"RASASI Hawas La Mer", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-luceo", name:"RASASI Hawas Luceo", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-terra", name:"RASASI Hawas Terra", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rasasi-hawas-dulce", name:"RASASI Hawas Dulce", brand:"Rasasi", line:"Hawas", mono:"R", blurb:"The Hawas line \u2014 arguably the most complimented fresh fragrance family in the game.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade", name:"Game of spade", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-bonus", name:"Game of Spade Bonus", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-full-house", name:"Game of Spade Full House", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-high-roller", name:"Game of Spade High Roller", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-king", name:"Game of Spade King", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-rouge-extrait-de-parfum", name:"Game of Spade Rouge Extrait De Parfum", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-rouge", name:"Game of Spade Rouge", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-trick", name:"Game of Spade Trick", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-double-bonus", name:"Game of Spade Double Bonus", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-wild-card", name:"Game of Spade Wild Card", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-royale", name:"Game of Spade Royale", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-all-in", name:"Game of Spade All In", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-black-sapphire", name:"Game of Spade Black Sapphire", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-emerald", name:"Game of Spade Emerald", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-no-limit", name:"Game of Spade No Limit", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-boston", name:"Game of Spade Boston", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-moon", name:"Game of Spade Moon", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-opel", name:"Game of Spade Opel", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-jack-pot", name:"Game of Spade Jack Pot", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-topaz", name:"Game of Spade Topaz", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-queen", name:"Game of Spade Queen", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-blind-bid", name:"Game of Spade Blind Bid", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-ace", name:"Game of Spade Ace", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-gold", name:"Game of Spade Gold", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-diamond", name:"Game of Spade Diamond", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-bid", name:"Game of Spade Bid", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-yellow-sapphire", name:"Game of Spade Yellow Sapphire", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-bluff", name:"Game of Spade bluff", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-win", name:"Game of Spade Win", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-ruby", name:"Game of Spade Ruby", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"game-of-spade-platinum", name:"Game of Spade Platinum", brand:"Jo Milano Paris", line:"Game of Spade", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-levante-intense", name:"Joe Milano Levante Intense", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-levante-platinum", name:"Joe Milano Levante platinum", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-levante-exclusive", name:"Joe Milano Levante exclusive", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-notes-2-beats", name:"Joe Milano Notes 2 Beats", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-notes-1-beats", name:"Joe Milano Notes 1 Beats", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-amalfi-bianco", name:"Joe Milano Amalfi Bianco", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-amalfi-viola", name:"Joe Milano Amalfi Viola", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-goal-colombia", name:"Joe Milano Goal Colombia", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-goal-argentina", name:"Joe Milano Goal Argentina", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-goal-portugal", name:"Joe Milano Goal Portugal", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-goal-brazil", name:"Joe Milano Goal Brazil", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-goal-mexico", name:"Joe Milano Goal Mexico", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-usa", name:"Joe Milano USA", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-england", name:"Joe Milano England", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"joe-milano-italy", name:"Joe Milano Italy", brand:"Jo Milano Paris", line:"Collections", mono:"JMP", blurb:"The Game of Spade phenomenon \u2014 luxury poker-chip bottles, elite juice.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"maison-asrar", name:"Maison Asrar", brand:"Maison Asrar", line:"Royal Collection", mono:"MA", blurb:"Royal Collection opulence \u2014 rich, regal Arabian blends.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"regent-royal-collection", name:"Regent Royal Collection", brand:"Maison Asrar", line:"Royal Collection", mono:"MA", blurb:"Royal Collection opulence \u2014 rich, regal Arabian blends.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"vanguard-royal-collection", name:"Vanguard Royal Collection", brand:"Maison Asrar", line:"Royal Collection", mono:"MA", blurb:"Royal Collection opulence \u2014 rich, regal Arabian blends.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"majesty-royal-collection", name:"Majesty Royal Collection", brand:"Maison Asrar", line:"Royal Collection", mono:"MA", blurb:"Royal Collection opulence \u2014 rich, regal Arabian blends.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fame-royal-collection", name:"Fame Royal Collection", brand:"Maison Asrar", line:"Royal Collection", mono:"MA", blurb:"Royal Collection opulence \u2014 rich, regal Arabian blends.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"khadlai-dream", name:"Khadlai Dream", brand:"Khadlaj", line:null, mono:"K", blurb:"Dreamy, viral vanilla-forward scents with a Middle Eastern soul.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"khadlai-vanilla-dunes", name:"Khadlai Vanilla Dunes", brand:"Khadlaj", line:null, mono:"K", blurb:"Dreamy, viral vanilla-forward scents with a Middle Eastern soul.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"khadlai-dream-original", name:"Khadlai Dream original", brand:"Khadlaj", line:null, mono:"K", blurb:"Dreamy, viral vanilla-forward scents with a Middle Eastern soul.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"shiyaaka-shadow", name:"Shiyaaka Shadow", brand:"Shiyaaka", line:null, mono:"S", blurb:"Under-the-radar gems with bold character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"shiyaaka-snow", name:"Shiyaaka Snow", brand:"Shiyaaka", line:null, mono:"S", blurb:"Under-the-radar gems with bold character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"shiyaaka-sky", name:"Shiyaaka Sky", brand:"Shiyaaka", line:null, mono:"S", blurb:"Under-the-radar gems with bold character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"shiyaaka-shadlaj", name:"Shiyaaka Shadlaj", brand:"Shiyaaka", line:null, mono:"S", blurb:"Under-the-radar gems with bold character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-liquid-brun-limited", name:"French Avenue Liquid Brun limited", brand:"French Avenue", line:null, mono:"FA", blurb:"French-styled Arabian perfumery \u2014 refined and distinctive.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-vulcan-feu", name:"French Avenue Vulcan Feu", brand:"French Avenue", line:null, mono:"FA", blurb:"French-styled Arabian perfumery \u2014 refined and distinctive.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-azzure-aoud", name:"French Avenue Azzure Aoud", brand:"French Avenue", line:null, mono:"FA", blurb:"French-styled Arabian perfumery \u2014 refined and distinctive.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"riffs-drift-season", name:"Riffs Drift Season", brand:"Riffs", line:null, mono:"R", blurb:"Seasonal standouts built for rotation.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"riffs-rise-season", name:"Riffs Rise Season", brand:"Riffs", line:null, mono:"R", blurb:"Seasonal standouts built for rotation.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-khamrah-qahwa", name:"Lattafa Khamrah Qahwa", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-khamrah-waha", name:"Lattafa Khamrah waha", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-qaed-al-fursan-brown", name:"Lattafa Qaed Al Fursan - Brown", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-qaed-al-fursan-white", name:"Lattafa Qaed Al Fursan - White", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-qaed-al-fursan-black", name:"Lattafa Qaed Al Fursan - Black", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-fakhar-black", name:"Lattafa Fakhar Black", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-fakhar-extract", name:"Lattafa Fakhar Extract", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-fakhar-platinum", name:"Lattafa Fakhar Platinum", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-asad", name:"Lattafa Asad", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-asad-zanzibar", name:"Lattafa Asad Zanzibar", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-asad-bourbon", name:"Lattafa Asad Bourbon", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-asad-elixir", name:"Lattafa Asad Elixir", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-maahir", name:"Lattafa Maahir", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-maahir-legacy", name:"Lattafa Maahir Legacy", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-maahir-black-edition", name:"Lattafa Maahir Black Edition", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-bade-e-al-oud-honor-glory", name:"Lattafa Bade'e Al Oud Honor & Glory", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-bade-e-al-oud-oud-for-glory", name:"Lattafa Bade'e Al Oud Oud for Glory", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-dynasty", name:"Lattafa Dynasty", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-vintage-radio-pride", name:"Lattafa Vintage Radio - Pride", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-art-of-universe-pride", name:"Lattafa Art Of Universe - Pride", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-new-york-city-pride", name:"Lattafa New York City - Pride", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-shaheen-silver-pride", name:"Lattafa Shaheen Silver - Pride", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-habik", name:"Lattafa Habik", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"lattafa-musamam-black-intense", name:"Lattafa Musamam Black Intense", brand:"Lattafa", line:null, mono:"L", blurb:"The internet\u2019s favorite house \u2014 Khamrah, Asad, Fakhar and more.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-maitre", name:"Jean Lowe Maitre", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-azure", name:"Jean Lowe Azure", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-noir", name:"Jean Lowe Noir", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-immortel", name:"Jean Lowe Immortel", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-summer-vibe", name:"Jean Lowe Summer Vibe", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-verde", name:"Jean Lowe Verde", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"jean-lowe-fraiche", name:"Jean Lowe Fraiche", brand:"Jean Lowe", line:null, mono:"JL", blurb:"Elegant, versatile scents for every occasion.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"arabiyat-prestige-marwa", name:"Arabiyat Prestige Marwa", brand:"Arabiyat Prestige", line:null, mono:"AP", blurb:"Prestige Arabian blends with depth and warmth.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"arabiyat-prestige-mahd-al-dhahab", name:"Arabiyat Prestige Mahd Al Dhahab", brand:"Arabiyat Prestige", line:null, mono:"AP", blurb:"Prestige Arabian blends with depth and warmth.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-drug", name:"Fragrance Story Drug", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-money", name:"Fragrance Story Money", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-deadly", name:"Fragrance Story Deadly", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-snow", name:"Fragrance Story snow", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-drug-extreme", name:"Fragrance Story Drug Extreme", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-mafia", name:"Fragrance Story Mafia", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-drug-extradise", name:"Fragrance Story Drug Extradise", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"fragrance-story-kill", name:"Fragrance Story Kill", brand:"Fragrance Story", line:null, mono:"FS", blurb:"Bold, unapologetic scents with attitude.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-x-aromatix-teas-me", name:"French Avenue x Aromatix \u2014 Teas Me", brand:"French Avenue x Aromatix", line:null, mono:"FAA", blurb:"A hyped collaboration drop.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-x-aromatix-magnetiq", name:"French Avenue x Aromatix \u2014 Magnetiq", brand:"French Avenue x Aromatix", line:null, mono:"FAA", blurb:"A hyped collaboration drop.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"french-avenue-x-aromatix-forbidden-fruit", name:"French Avenue x Aromatix \u2014 Forbidden Fruit", brand:"French Avenue x Aromatix", line:null, mono:"FAA", blurb:"A hyped collaboration drop.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"haramain-amber-oud-ruby-edition", name:"Haramain Amber Oud Ruby Edition", brand:"Haramain", line:"Amber Oud", mono:"H", blurb:"Amber Oud royalty \u2014 rich, resinous, unforgettable.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"haramain-amber-oud-tabacco-edition", name:"Haramain Amber Oud Tabacco Edition", brand:"Haramain", line:"Amber Oud", mono:"H", blurb:"Amber Oud royalty \u2014 rich, resinous, unforgettable.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"haramain-amber-oud-aqua-dubai", name:"Haramain Amber Oud Aqua Dubai", brand:"Haramain", line:"Amber Oud", mono:"H", blurb:"Amber Oud royalty \u2014 rich, resinous, unforgettable.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"dumont-nitro-four-homme-intense", name:"Dumont Nitro Four Homme Intense", brand:"Dumont", line:"Nitro Four", mono:"D", blurb:"Nitro Four intensity \u2014 built to perform.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"dumont-nitro-four-homme-elixir", name:"Dumont Nitro Four Homme Elixir", brand:"Dumont", line:"Nitro Four", mono:"D", blurb:"Nitro Four intensity \u2014 built to perform.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"dumont-nitro-four-homme-red", name:"Dumont Nitro Four Homme Red", brand:"Dumont", line:"Nitro Four", mono:"D", blurb:"Nitro Four intensity \u2014 built to perform.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"dumont-nitro-four-homme-blue", name:"Dumont Nitro Four Homme Blue", brand:"Dumont", line:"Nitro Four", mono:"D", blurb:"Nitro Four intensity \u2014 built to perform.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"dumont-nitro-four-homme-gold", name:"Dumont Nitro Four Homme Gold", brand:"Dumont", line:"Nitro Four", mono:"D", blurb:"Nitro Four intensity \u2014 built to perform.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"bharaara-king", name:"Bharaara King", brand:"Bharaara", line:"King", mono:"B", blurb:"King-line dominance \u2014 bold Arabian character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"bharaara-king-don", name:"Bharaara King Don", brand:"Bharaara", line:"King", mono:"B", blurb:"King-line dominance \u2014 bold Arabian character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"bharaara-king-bleu", name:"Bharaara King Bleu", brand:"Bharaara", line:"King", mono:"B", blurb:"King-line dominance \u2014 bold Arabian character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"bharaara-viking-kashmir", name:"Bharaara Viking Kashmir", brand:"Bharaara", line:"King", mono:"B", blurb:"King-line dominance \u2014 bold Arabian character.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"bujairami-hectic-extrait-de-parfum", name:"Bujairami Hectic Extrait de Parfum", brand:"Bujairami", line:null, mono:"B", blurb:"Rare finds for the true connoisseur.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"rrq-x-mykonos-empire", name:"RRQ x Mykonos \u2014 Empire", brand:"RRQ x Mykonos", line:null, mono:"RM", blurb:"Limited collaboration \u2014 Empire.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"velixir-icarus", name:"velixir icarus", brand:"Velixir", line:null, mono:"V", blurb:"Exclusive drops, limited availability.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
  {id:"gulf-orchid-mango-ice", name:"Gulf Orchid Mango Ice", brand:"Gulf Orchid", line:null, mono:"GO", blurb:"Gulf-born freshness with a twist.", prices:{'3ml':9,'5ml':14,'10ml':24}, badges:['100% Authentic','Hand-poured']},
];
/* ═══ The Frag Man Plug — demo store logic (real catalog) ═══ */

const SIZES = [
  { id:'3ml',  label:'3ml Decant',  sub:'~35 sprays · perfect taster' },
  { id:'5ml',  label:'5ml Decant',  sub:'~65 sprays · 2–3 weeks wear' },
  { id:'10ml', label:'10ml Decant', sub:'~130 sprays · a month+ wear' },
];

const BRANDS = [...new Set(PRODUCTS.map(p=>p.brand))].sort();

/* featured picks — house icons, by exact id with graceful fallback */
const FEATURED_IDS = ['lattafa-asad','armaf-club-de-nuit-intense-man-edt','rasasi-hawas-original','9pm'];
const byId = id => PRODUCTS.find(p=>p.id===id);

/* ── state ── */
let cart = [];
let activeBrand = 'all';
let searchTerm = '';
let mixSearch = '';
let pmProduct = null, pmSize = '5ml';
let mixBase = null, mixAccent = null, mixRatio = '60/40', mixSize = { s:'10ml', p:42 };

const $ = s => document.querySelector(s);
const money = n => '$' + n;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const famLabel = p => p.line ? `${p.brand} · ${p.line}` : p.brand;

/* ── product cards ── */
function cardHTML(p){
  return `<article class="card reveal" data-card="${p.id}">
    <div class="card-visual mono">
      <div class="mono-tile">${esc(p.mono)}</div>
      <span class="demo-tag">demo price</span>
    </div>
    <div class="card-body">
      <p class="card-family">${esc(famLabel(p).toUpperCase())}</p>
      <h3>${esc(p.name)}</h3>
      <p class="card-notes">${esc(p.blurb)}</p>
      <div class="card-foot">
        <span class="card-price">${money(p.prices['3ml'])}<small>3ml decant · demo price</small></span>
        <button class="card-btn" data-view="${p.id}">View</button>
      </div>
    </div>
  </article>`;
}

function filteredProducts(){
  const q = searchTerm.trim().toLowerCase();
  return PRODUCTS.filter(p=>{
    if(activeBrand!=='all' && p.brand!==activeBrand) return false;
    if(q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.line||'').toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderShop(){
  const list = filteredProducts();
  $('#shopGrid').innerHTML = list.map(cardHTML).join('') ||
    `<p class="muted" style="text-align:center;grid-column:1/-1;padding:2rem">No fragrances match — try a different search or brand.</p>`;
  const total = PRODUCTS.length;
  $('#shopCount').textContent = list.length===total
    ? `${total} fragrances · ${BRANDS.length} brands`
    : `Showing ${list.length} of ${total}`;
  observeReveals();
}

function renderBrandChips(){
  $('#brandChips').innerHTML =
    `<button class="chip active" data-brand="all">All (${PRODUCTS.length})</button>` +
    BRANDS.map(b=>{
      const n = PRODUCTS.filter(p=>p.brand===b).length;
      return `<button class="chip" data-brand="${esc(b)}">${esc(b)} (${n})</button>`;
    }).join('');
}

function renderFeatured(){
  const picks = FEATURED_IDS.map(byId).filter(Boolean);
  while(picks.length<4) picks.push(PRODUCTS[picks.length]);
  $('#featuredGrid').innerHTML = picks.slice(0,4).map(cardHTML).join('');
}

/* ── reveal on scroll ── */
let io;
function observeReveals(){
  if(!('IntersectionObserver' in window)){ document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')); return; }
  io = io || new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.04});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));
}

/* ── product modal ── */
function openProduct(id){
  const p = byId(id); if(!p) return;
  pmProduct = p; pmSize = '5ml';
  $('#pmEyebrow').textContent = famLabel(p);
  $('#pmName').textContent = p.name;
  $('#pmMono').textContent = p.mono;
  $('#pmDesc').textContent = p.blurb + ' Poured fresh from sealed, authentic stock — decanted to order in Florida.';
  $('#pmBadges').innerHTML = p.badges.map(b=>`<span class="pm-badge">✦ ${b}</span>`).join('') +
    `<span class="pm-badge demo">demo price</span>`;
  $('#pmSizes').innerHTML = SIZES.map(s=>
    `<button data-size="${s.id}" class="${s.id===pmSize?'active':''}">${s.label}<small>${s.sub} · ${money(p.prices[s.id])}</small></button>`).join('');
  $('#pmPrice').textContent = money(p.prices[pmSize]);
  $('#productModal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(){ $('#productModal').hidden = true; document.body.style.overflow = ''; }

/* ── cart ── */
function addToCart(name, detail, price){
  cart.push({name, detail, price});
  renderCart(); toast(`Added — ${name} (${detail})`);
}
function renderCart(){
  $('#cartCount').textContent = cart.length;
  const box = $('#cartItems');
  if(!cart.length){ box.innerHTML = '<p class="cart-empty">Your cart is empty.<br>The scent journey begins with a decant. ✦</p>'; }
  else box.innerHTML = cart.map((it,i)=>`
    <div class="cart-item"><div class="ci-info"><strong>${esc(it.name)}</strong><small>${esc(it.detail)}</small></div>
    <span class="ci-price">${money(it.price)}</span>
    <button class="ci-rm" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('');
  $('#cartTotal').textContent = money(cart.reduce((a,b)=>a+b.price,0));
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, 2600);
}

/* ── mix builder ── */
function mixList(){
  const q = mixSearch.trim().toLowerCase();
  if(!q) return PRODUCTS;
  return PRODUCTS.filter(p=>p.name.toLowerCase().includes(q)||p.brand.toLowerCase().includes(q));
}
function renderMixPicks(){
  const list = mixList();
  const mk = (el, sel, other, fn) => {
    el.innerHTML = list.map(p=>{
      const dis = (p.id===other) ? ' disabled' : '';
      return `<div class="mix-pick${sel===p.id?' sel':''}${dis}" data-id="${p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.brand)}</small></div>`;
    }).join('') || '<p class="muted small">No matches.</p>';
    el.querySelectorAll('.mix-pick:not(.disabled)').forEach(d=>d.onclick=()=>fn(d.dataset.id));
  };
  mk($('#mixBase'), mixBase, mixAccent, id=>{ mixBase = (mixBase===id?null:id); renderMixPicks(); updateMix(); });
  mk($('#mixAccent'), mixAccent, mixBase, id=>{ mixAccent = (mixAccent===id?null:id); renderMixPicks(); updateMix(); });
  $('#mixCount').textContent = `${list.length} scents to blend`;
}
function updateMix(){
  const b = byId(mixBase), a = byId(mixAccent);
  const btn = $('#mixAdd');
  if(b && a && b.id!==a.id){
    const name = `${b.name} × ${a.name}`;
    $('#mixName').textContent = name;
    $('#mixDesc').textContent = `${mixRatio} — ${b.name} leading, ${a.name} weaving through. Blended fresh to order, rested 48 hours.`;
    $('#mixPrice').textContent = `${mixSize.s} · ${money(mixSize.p)}`;
    btn.disabled = false;
    btn.onclick = ()=>addToCart('Custom Hybrid Mix', `${name} · ${mixRatio} · ${mixSize.s} · demo price`, mixSize.p);
  } else {
    $('#mixName').textContent = 'Select a base & accent';
    $('#mixDesc').textContent = 'Pick two different fragrances above to preview your hybrid.';
    $('#mixPrice').textContent = ''; btn.disabled = true; btn.onclick = null;
  }
}

/* ── FAQ accordion ── */
function initFaq(){
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', ()=>{
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o=>o.classList.remove('open'));
      if(!open) item.classList.add('open');
    });
  });
}

/* ── events ── */
document.addEventListener('click', e=>{
  const v = e.target.closest('[data-view]');
  if(v){ openProduct(v.dataset.view); return; }
  const card = e.target.closest('[data-card]');
  if(card){ openProduct(card.dataset.card); return; }
  if(e.target.closest('[data-close]')){ closeModal(); $('#drawerWrap').hidden = true; document.body.style.overflow=''; return; }
  const rm = e.target.closest('[data-rm]'); if(rm){ cart.splice(+rm.dataset.rm,1); renderCart(); return; }
  const sz = e.target.closest('#pmSizes button'); if(sz){ pmSize = sz.dataset.size;
    document.querySelectorAll('#pmSizes button').forEach(b=>b.classList.toggle('active', b===sz));
    $('#pmPrice').textContent = money(pmProduct.prices[pmSize]); return; }
  const chip = e.target.closest('.chip'); if(chip){
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active');
    activeBrand = chip.dataset.brand; renderShop(); return; }
});
$('#pmAdd').onclick = ()=>{ if(!pmProduct) return; const s = SIZES.find(x=>x.id===pmSize);
  addToCart(pmProduct.name, `${pmProduct.brand} · ${s.label} · demo price`, pmProduct.prices[pmSize]); };
$('#cartBtn').onclick = ()=>{ $('#drawerWrap').hidden = false; document.body.style.overflow='hidden'; };
$('#checkoutBtn').onclick = ()=>toast('Demo checkout — the real store will process payment securely.');
$('#burger').onclick = ()=>$('#navLinks').classList.toggle('open');
document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>$('#navLinks').classList.remove('open')));
$('#shopSearch').addEventListener('input', e=>{ searchTerm = e.target.value; renderShop(); });
$('#mixRatio').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixRatio button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixRatio = b.dataset.r; updateMix(); });
$('#mixSize').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixSize button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixSize = { s:b.dataset.s, p:+b.dataset.p }; updateMix(); });
$('#mixSearch').addEventListener('input', e=>{ mixSearch = e.target.value; renderMixPicks(); });
$('#notifyForm').addEventListener('submit', e=>{ e.preventDefault();
  const em = $('#notifyEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Please enter a valid email address.'); $('#notifyEmail').focus(); return; }
  $('#notifyForm').hidden = true; $('#notifyOk').hidden = false; toast('You\u2019re on the launch list ✦'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); $('#drawerWrap').hidden=true; document.body.style.overflow=''; }});

/* ── init ── */
renderBrandChips(); renderFeatured(); renderShop();
renderMixPicks(); updateMix(); renderCart(); initFaq();
