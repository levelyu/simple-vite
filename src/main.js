// import { add } from './export.js';

// console.log(add(1, 2));

import { createApp, h } from 'vue';
import _ from 'lodash';
createApp({
    render() {
        return h('h1', 'this is render by main.js');
    }
}).mount('#app');
console.log(_.defaults({ 'a': 1 }, { 'a': 3, 'b': 2 }));