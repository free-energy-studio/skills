#!/usr/bin/env bash
# Generate a 3-word slug: adj-noun-noun (~2.1M permutations)
set -euo pipefail

ADJECTIVES=(bold brave bright calm clean clear cold cool crisp dark deep dry fair fast fine firm flat free fresh full glad gold good grand gray green happy hard high hot huge keen kind last late lean light live long lost loud low main mild neat new next nice odd old open pale past plain proud pure quick quiet rare raw real red rich ripe rough round royal safe sharp shy slim slow small smart smooth soft solid sour spare steep still stout sweet swift tall tame thin tight tiny tough true vast vivid warm weak wet whole wide wild wise)

NOUNS=(ant ape ash axe bay bee bird boat bone book bowl bull cape cave clay cliff cloud coal corn crab crow dale dawn deer dove drum duck dusk dust elm fawn fig fin fir fish fist flint flock foam fog fox frog frost gate gem goat grape grove gust hare hawk hay hill hive hog horn hound ink iron isle ivy jade jay kale kelp kite lake lark lava leaf lime lion lynx mace marsh mint mist moon moss moth mule nest oak ore otter owl palm paw peak pine plum pond quail rain ram reed ridge ring river road robin rock root rose rust sage sand seal seed shell sky slate sleet slug snail snow spark spring star steel stone storm stork stream sun swan thorn tide toad trail tree trout vale vine vole wave weed whale wind wolf wood wren yak yew zinc)

pick() {
  local arr=("$@")
  echo "${arr[$((RANDOM % ${#arr[@]}))]}"
}

echo "$(pick "${ADJECTIVES[@]}")-$(pick "${NOUNS[@]}")-$(pick "${NOUNS[@]}")"
