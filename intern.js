/*
 * Copyright (C) 2012 John Krauss
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint browser: true, vars: true, nomen: true, plusplus: true*/
/*globals $, d3*/

(function () {
    "use strict";
    var QUESTIONS_LOCATION = "data/questions.tsv",
        DEMOGRAPHICS_LOCATION = "data/demographics.tsv",
        VERSION = "1",
        FIRST_QUESTION = "1",
        BUTTON_COLUMNS = ['Yes', 'No', "Not sure"],
        MESSAGE_COLUMN = 'Message',
        BUTTON_CLASSES = 'btn btn-large',
        BUTTON_TEMPLATE = '<button class="' + BUTTON_CLASSES + '" />',
        RECORD_HOST = 'http://intern-labor-survey.herokuapp.com/',
        RECORD_ENDPOINT = '',
        textMeasure = $('#text-measure text')[0],
        $intro = $('#intro'),
        $question = $('#question').hide(),
        $doSurvey = $('.do-survey'),
        $demographics = $('#demographics').hide(),
        $demographicsQuestions = $('#demographics #questions'),
        $thanks = $('#thanks').hide(),
        $choices = $('#choices'),
        $endgame = $('#endgame'),
        $reset = $('#reset a'),
        $flowchart = $('#flowchart'),
        width,
        height = 300,
        edgePadding = 20,
        svg,
        $start = $('#start a'),
        $submit = $('#submit a'),
        squareInCircle = 1.7,
        showChildren,
        questions,
        demographics,

        /**
         * Display the endgame scenario.
         */
        endgame = function (id) {
            $question.hide();
            $doSurvey.show();
            //$reset.hide();
            $('#' + id).show().parents().show();
            $flowchart.detach().appendTo($doSurvey);
        },

        /**
         * Input is a raw multi-line TSV as a string.  Output is a JSON
         * object with the first column used as the key for the hash.
         */
        parseTSV = function (tsv) {
            var parsed = {},
                rows = tsv.split('\n'),
                header = rows.shift().split('\t');
            $.each(rows, function (i, row) {
                var cols = row.split('\t'),
                    question = {};
                $.each(cols, function (i, col) {
                    question[header[i]] = col;
                });
                // assume first data column is ID
                parsed[cols[0]] = question;
            });
            return parsed;
        },

        /**
         * Determine radius needed for circle
         *
         * TODO: DRY out with the text rendering
         */
        determineRadius = function (allText) {
            var radius = 30;

            while (true) {
                var i,
                    lineHeight = 16,
                    padding = lineHeight / 2,
                    h = padding / 2,
                    r = radius - padding,
                    maxWidth,
                    words = allText.split(/\s+/),
                    lastLineEndIdx = 0,
                    text,
                    length;

                for (i = 0; i < words.length + 1; i += 1) {
                    // add words to tspan until out of space, then
                    // go to new line (new tspan).

                    textMeasure.textContent = (words.slice(lastLineEndIdx, i + 1).join(' '));
                    length = textMeasure.getComputedTextLength();
                    maxWidth = 2 * Math.sqrt(h * (2 * r - h));
                    if (length > maxWidth || i === words.length) {
                        text = words.slice(lastLineEndIdx, i).join(' ');
                        textMeasure.textContent = text;
                        //.attr('x', -maxWidth / 2)
                        //.attr('x', -length / 2)
                        lastLineEndIdx = i;
                        h += lineHeight;
                    }
                }

                if (h < radius * 2) {
                    return radius;
                }

                radius += 10;
            }
        },

        /**
         * Convert questions to nodes and links (returned as two-tuple).
         */
        toNodesAndLinks = function (questions, firstQuestion) {
            var nodesAry = [],
                nodesObj = {},
                links = [],
                linksObj = {},
                numTerm = 0,
                makeNode = function (k) {
                    var q = questions[k] || {
                        ID: k,
                        Message: k
                    },
                        node = nodesObj[k],
                        target,
                        link,
                        i,
                        r,
                        b;
                    if (!node) {
                        r = determineRadius(q.Message);
                        node = {
                            id: q.ID,
                            radius: r,
                            text: q.Message,
                            y: edgePadding + r,
                            x: Math.random() * (width - (edgePadding * 2) - (r * 2))
                                + edgePadding + r,
                            scale: 1,
                            from: [],
                            to: []
                        };

                        // Fix first node at bottom
                        if (k === firstQuestion) {
                            //node.x = width / 3;
                            node.y = height - edgePadding - r;
                            node.fixed = true;
                        }

                        nodesObj[k] = node;
                        nodesAry.push(node);
                    }
                    for (i = 0; i < BUTTON_COLUMNS.length; i += 1) {
                        b = BUTTON_COLUMNS[i];
                        if (q[b]) {
                            if (!linksObj[node.id + '-' + q[b]]) {
                                target = makeNode(q[b]);
                                link = {
                                    source: node,
                                    target: target,
                                    id: node.id + '-' + q[b],
                                    text: b
                                };
                                node.to.push(link);
                                target.from.push(link);
                                links.push(link);
                                linksObj[link.id] = link;
                            }
                        }
                    }
                    return node;
                };

            makeNode(firstQuestion);

            return nodesAry[0];
        },

        /**
         * Record the response to a question.
         */
        record = function (question, button) {
            $.ajax({
                url: RECORD_HOST + RECORD_ENDPOINT,
                data: {q: question, a: button, v: VERSION},
                crossDomain: true
            });
        },

        /**
         * Ask a question.
         */
        ask = function (id, questions) {
            var question = questions[id];
            $('.text', $question).html(question[MESSAGE_COLUMN]);
            $choices.empty();
            $.each(BUTTON_COLUMNS, function (i, button) {
                var nextId = question[button];
                if (nextId !== '') {
                    $(BUTTON_TEMPLATE)
                        .text(button)
                        .on('click', function () {
                            showChildren(id + '-' + nextId);
                            record(question[MESSAGE_COLUMN], button);
                            if (questions[nextId]) {
                                ask(nextId, questions);
                            } else {
                                endgame(nextId, questions);
                            }
                        }).appendTo($choices);
                }
            });

            if ($choices.is(':empty')) {
                endgame();
            }
        },

        // test whether two lines intersect (each line is a two-tuple of
        // two-tuples)
        // http://tog.acm.org/resources/GraphicsGems/gemsii/xlines.c
        linesIntersect = function (line1, line2) {
            var x1 = line1[0][0],
                x2 = line1[1][0],
                y1 = line1[0][1],
                y2 = line1[1][1],
                x3 = line2[0][0],
                x4 = line2[1][0],
                y3 = line2[0][1],
                y4 = line2[1][1],

                a1 = y2 - y1,
                b1 = x1 - x2,
                c1 = x2 * y1 - x1 * y2,

                a2 = y4 - y3,
                b2 = x3 - x4,
                c2 = x4 * y3 - x3 * y4,

                r1 = a2 * x1 + b2 * y1 + c2,
                r2 = a2 * x2 + b2 * y2 + c2,
                r3 = a1 * x3 + b1 * y3 + c1,
                r4 = a1 * x4 + b1 * y4 + c1,

                denom = a1 * b2 - a2 * b1,

                offset = denom < 0 ? -denom / 2 : denom / 2,

                xnum,
                ynum;

            // no intersection
            if ((r3 < 0 && r4 < 0) || (r3 > 0 && r4 > 0)) {
                return false;
            }

            // collinear
            if (denom === 0) {
                return false;
            }

            xnum = b1 * c2 - b2 * c1;
            ynum = a2 * c1 - a1 * c2;

            // calculate intersection point
            return [(xnum < 0 ? xnum - offset : xnum + offset) / denom,
                (ynum < 0 ? ynum - offset : ynum + offset) / denom];

        },

        collide = function (node, alpha) {
            var nx1 = node.x - node.radius * node.scale,
                nx2 = node.x + node.radius * node.scale,
                ny1 = node.y - node.radius * node.scale,
                ny2 = node.y + node.radius * node.scale;
            return function (quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== node)) {
                    var x = node.x - quad.point.x,
                        y = node.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        extraPad = 40,
                        r = ((node.radius * node.scale) + (quad.point.radius * quad.point.scale)) + extraPad;

                    // always expand hovering nodes
                    if (node.hover) {
                        node.scale = node.scale < 1 ? node.scale * 1.02 : 1;
                    } else if (l < r) {
                        l = (l - r) / (l || 1) * 0.1 * alpha;
                        if (!node.hover) {
                            node.x -= x *= l;
                            node.y -= y *= l;
                        }
                        if (!quad.point.hover) {
                            quad.point.x += x;
                            quad.point.y += y;
                        }
                        // only scale non-terminal points down,
                        // favor scaling down non-essential nodes
                        // don't scale stuff less than 50%
                        if (node.to.length > 0 && node.from.length > 0
                                && node.scale > 0.7 && !node.hover) {
                            node.scale *= 1 - (0.05 / (node.to.length +
                                                      node.from.length));
                        }
                        if (quad.point.to.length > 0 && quad.point.from.length > 0
                                && quad.point.scale > 0.7 && !quad.point.hover) {
                            quad.point.scale *= 1 - (0.05 / (quad.point.to.length +
                                                            quad.point.from.length));
                        }
                    } else {
                        node.scale = node.scale < 1 ? node.scale * 1.005 : 1;
                        quad.point.scale = quad.point.scale < 1 ? quad.point.scale * 1.005 : 1;
                    }
                }
                return x1 > nx2
                    || x2 < nx1
                    || y1 > ny2
                    || y2 < ny1;
            };
        },

        /**
         * Draw the flowchart visualization.
         */
        visualize = function (first_question, questionsData) {

            var node = toNodesAndLinks(questionsData, first_question),
                force,
                restart,
                nodes = [node],
                links = [],
                nodesObj = {},
                linksObj = {},
                //width = $('#survey').width(),
                width = $(window).width(),

                svg = d3.select('#flowchart')
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style({
                        'left': -Math.round($('#survey div').position().left)
                    }),

                // handles to link and node element groups
                questions = svg.append('svg:g').selectAll('g'),
                path = svg.append('svg:g').selectAll('path'),

                // update force layout (called automatically each iteration)
                tick = function (evt) {
                    var q = d3.geom.quadtree(nodes),
                        d,
                        n,
                        j,
                        i,
                        lowestPoint = 0;

                    // Hard edges except on top, which can stretch.
                    for (i = 0; i < nodes.length; i += 1) {
                        n = nodes[i];
                        if (n.x - (n.radius * n.scale) < edgePadding) {
                            n.px = n.x;
                            n.x = (n.x + edgePadding + n.radius * n.scale) / 2;
                        } else if (n.x + n.radius * n.scale * 2 > width - edgePadding) {
                            n.px = n.x;
                            n.x = (n.x - edgePadding + width - n.radius * n.scale * 2) / 2;
                        }

                        d = n.y - edgePadding - (n.radius * n.scale);
                        if (d < 0) {
                            //n.y = (n.y + edgePadding + n.radius * n.scale) / 2;

                            // Expand "upwards" by pushing all nodes down.
                            for (j = 0; j < nodes.length; j += 1) {
                                nodes[j].py = nodes[j].y;
                                nodes[j].y += -d / 2;
                            }
                            height += -d;
                            svg.attr('height', Math.round(height));
                        } else if (n.y + n.radius > height - edgePadding) {
                            n.py = n.y;
                            n.y = (n.y - edgePadding + height - n.radius * n.scale) / 2;
                        }
                    }

                    for (i = 0; i < nodes.length; i += 1) {
                        n = nodes[i];
                        q.visit(collide(n, evt.alpha));
                        // adjust svg to fit height
                        if (n.y + n.radius * n.scale * 2 > lowestPoint) {
                            lowestPoint = n.y + n.radius * n.scale * 2;
                            height = lowestPoint;
                            svg.attr('height', Math.round(height));
                        }
                    }

                    questions.attr('transform', function (d) {
                        return 'translate(' + d.x + ',' + d.y + ')' +
                            'scale(' + d.scale +  ',' + d.scale + ')';
                    });

                    path.each(function (d) {

                        var deltaX = d.target.x - d.source.x,
                            deltaY = d.target.y - d.source.y,
                            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                            normX = deltaX / dist,
                            normY = deltaY / dist,
                            sourcePadding = d.source.radius * d.source.scale,
                            targetPadding = d.target.radius * d.target.scale,
                            sourceX = d.source.x + (sourcePadding * normX),
                            sourceY = d.source.y + (sourcePadding * normY),
                            targetX = d.target.x - (targetPadding * normX),
                            targetY = d.target.y - (targetPadding * normY),
                            $this = d3.select(this);

                        $this.select('path')
                            .attr('display', d.expanded === true ? 'display' : 'none')
                            .attr('d', 'M' + sourceX + ',' + sourceY + 'L'
                                  + targetX + ',' + targetY);

                        $this.select('circle.answer')
                            .attr('display', d.source.visible === true ? 'display' : 'none')
                            .attr('cx', sourceX + (7 * normX))
                            .attr('cy', sourceY + (7 * normY));

                        $this.select('text.answer')
                            .attr('display', d.source.visible === true ? 'display' : 'none')
                            .attr('x', sourceX + (7 * normX))
                            .attr('y', sourceY + (7 * normY) + 6);
                    });

                    if (svg.attr('width') !== $(window).width()) {
                        svg.attr('width', Math.round($(window).width()));
                        svg.style({
                            left: -$('#share').position().left
                        });
                    }
                };

            // set up initial conditions -- single visible node with stubs
            // rendered
            node.visible = true;
            nodesObj[node.id] = node;
            var i;
            for (i = 0; i < node.to.length; i += 1) {
                links.push(node.to[i]);
                nodes.push(node.to[i].target);
                linksObj[node.to[i].id] = node.to[i];
                nodesObj[node.to[i].target.id] = node.to[i].target;
            }

            // define arrow markers for graph links
            svg.append('svg:defs').append('svg:marker')
                .attr('id', 'end-arrow')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 6)
                .attr('markerWidth', 7)
                .attr('markerHeight', 7)
                .attr('orient', 'auto')
                .append('svg:path')
                .attr('d', 'M0,-5L10,0L0,5');
                //.attr('fill', '#000');

            // Show children.
            showChildren = function (linkId) {
                var d = linksObj[linkId];
                if (!d.expanded) {
                    d.target.visible = true;
                    d.expanded = true;

                    var link, node, i;

                    for (i = 0; i < nodes.length; i += 1) {
                        nodes[i].fixed = false;
                    }

                    d.target.fixed = true;
                    d.target.py = d.target.y;
                    d.target.y += d.target.radius;
                    for (i = 0; i < d.target.to.length; i += 1) {
                        link = d.target.to[i];
                        node = link.target;
                        if (!linksObj[link.id]) {
                            links.push(link);
                            linksObj[link.id] = link;
                        }

                        if (!nodesObj[node.id]) {
                            node.y = edgePadding + node.radius;
                            node.x = (Math.random() * (width
                                      - (edgePadding * 2)
                                      - (node.radius * node.scale)))
                                + edgePadding + node.radius * node.scale;
                            node.fixed = true;
                            nodes.push(node);
                            nodesObj[node.id] = node;
                        }
                    }

                    restart();
                }
            };

            restart = function () {
                // path (link) group
                path = path.data(links, function (d) { return d.id; });

                // add new links
                path.enter().append('svg:g')
                    .append('svg:path')
                    .attr('class', function (d) {
                        return 'link ' + d.text.toLowerCase().replace(/\s+/g, '-');
                    })
                    .style('marker-end', 'url(#end-arrow)')
                    .each(function (d) {
                        d.el = d3.select(this);
                    });

                // answer circles on links
                path.append('svg:circle')
                    .attr('class', function (d) {
                        return 'answer ' + d.text.toLowerCase().replace(/\s+/g, '-');
                    })
                    .attr('display', 'none')
                    .attr('id', function (d) { return 'answer-' + d.id; })
                    .attr('r', 10)
                    .on('click', function (d) {
                        showChildren(d.id);
                    });

                // letter inside answer circle
                path.append('svg:text')
                    .classed('answer', true)
                    .attr('dx', '-10')
                    .each(function (d) {
                        var $this = d3.select(this),
                            text,
                            offset;
                        switch (d.text.toLowerCase()) {
                        case 'yes':
                            text = 'Y';
                            offset = -5;
                            break;
                        case 'no':
                            text = 'N';
                            offset = -7;
                            break;
                        case 'not sure':
                            text = '?';
                            offset = -3;
                            break;
                        default:
                            break;
                        }
                        $this.text(text)
                            .attr('dx', offset);
                    });

                // remove old links
                path.exit().remove();

                // questions (node) group
                // NB: the function arg is crucial here! nodes are known by id, not by index!
                questions = questions.data(nodes, function (d) { return d.id; });

                // add new nodes
                var g = questions.enter()
                    .append('svg:g')
                    .attr('display', 'none');

                g.append('svg:circle')
                    .attr('class', function (d) {
                        var klass = 'node';
                        if (d.from.length === 0 || d.to.length === 0) {
                            klass += ' terminal';
                        }
                        return klass;
                    })
                    .on('mouseover', function (d) {
                        d.hover = true;
                        restart();
                    })
                    .on('mouseout', function (d) {
                        d.hover = undefined;
                    })
                    .attr('r', function (d) { return d.radius; });

                questions.each(function (d) {
                    if (d.visible === true) {
                        d3.select(this).attr('display', undefined);
                    }
                });

                g.append('svg:text')
                    .classed('node', true)
                    //.attr('width', function (d) { return d.radius * squareInCircle; })
                    //.attr('height', function (d) { return d.radius * squareInCircle; })
                    /*.on('mouseover', function (d) {
                        var i, j, el, classes = ['from', 'to'];
                        for (i = 0; i < classes.length; i += 1) {
                            for (j = 0; j < d[classes[i]].length; j += 1) {
                                el = d[classes[i]][j].el;
                                if (el) {
                                    el.classed(classes[i], true);
                                }
                            }
                        }
                        if (d.scale < 0.9) {
                            force.resume();
                        }
                        d.hover = true;
                    })
                    .on('mouseout', function (d) {
                        var i, j, el, classes = ['from', 'to'];
                        for (i = 0; i < classes.length; i += 1) {
                            for (j = 0; j < d[classes[i]].length; j += 1) {
                                el = d[classes[i]][j].el;
                                if (el) {
                                    el.classed(classes[i], false);
                                }
                            }
                        }
                        d.hover = undefined;
                    })*/
                    //.attr('x', function (d) { return -d.radius; })
                    //.attr('y', function (d) { return -d.radius; })
                    // draw text using tspan inside the circle
                    .each(function (d) {
                        var $this = d3.select(this),
                            i,
                            lineHeight = 16,
                            padding = lineHeight / 2,
                            h = padding / 2,
                            r = d.radius - padding,
                            maxWidth,
                            words = d.text.split(/\s+/),
                            lastLineEndIdx = 0,
                            text,
                            length;

                        for (i = 0; i < words.length + 1; i += 1) {
                            // add words to tspan until out of space, then
                            // go to new line (new tspan).

                            textMeasure.textContent = (words.slice(lastLineEndIdx, i + 1).join(' '));
                            length = textMeasure.getComputedTextLength();
                            maxWidth = 2 * Math.sqrt(h * (2 * r - h));
                            if (length > maxWidth || i === words.length) {
                                text = words.slice(lastLineEndIdx, i).join(' ');
                                textMeasure.textContent = text;
                                $this.append('svg:tspan')
                                    //.attr('x', -maxWidth / 2)
                                    //.attr('x', -length / 2)
                                    .attr('x', -(textMeasure.getComputedTextLength()) / 2)
                                    .attr('y', h - r + padding)
                                    .text(text);
                                lastLineEndIdx = i;
                                h += lineHeight;
                            }
                        }
                    });

                // remove old nodes
                questions.exit().remove();

                force.size([width, height]).start();
            };

            //d3.timer(tick);
            force = d3.layout.force()
                .nodes(nodes)
                .links(links)
                .gravity(0)
                // central node -- strong positive charge
                /*.charge(function (d) {
                    if (!d.to.visible) { return 0; }
                    return ((d.from.length + d.to.length) * 20) - 500;
                })*/

                .charge(function (d) {
                    if (!d.visible) { return 0; }
                    return -400;
                })

                // central node -- long links
                .linkDistance(function (link) {
                    return (link.target.radius + link.source.radius +
                        Math.pow(link.target.from.length, 2)) * 1.25;
                })
                /*.linkDistance(function (link) {
                    //if (!link.expanded) { return 0; }
                    return (link.target.radius + link.source.radius) * 1.25;
                })*/

                // central node -- strong links
                /*.linkStrength(function (link) {
                    return 10 / link.target.from.length;
                })*/

                //.linkStrength(1)
                .size([width, height])
                .on('tick', tick);

            restart();

        };

    // load questions
    $.get(QUESTIONS_LOCATION).done(function (resp) {
        // stateful
        questions = parseTSV(resp);
        visualize(FIRST_QUESTION, questions);
        $start.on('click', function () {
            $('div', $endgame).hide();
            $intro.slideUp();
            $question.show();
            ask(FIRST_QUESTION, questions);
        });
        $reset.on('click', function () {
            $thanks.slideUp('fast', function () {
                $intro.slideDown();
            });
        });
        $('a', $doSurvey).on('click', function () {
            $endgame.slideUp('fast', function () {
                $demographics.slideDown();
            });
        });
        $submit.on('click', function () {
            $demographics.slideUp('fast', function () {
                $thanks.slideDown();
            });
        });
    });

    // load demographics (not shown immediately)
    $.get(DEMOGRAPHICS_LOCATION).done(function (resp) {
        var i, j, l, $q, $s,
            submit = function (evt) {
                var $el = $(evt.target),
                    q = $el.parent().text(),
                    a = $el.val();
                if (q && a) {
                    record($el.parent().text(), $el.val());
                }
            };
        resp = resp.split('\n');
        for (i = 0; i < resp.length; i += 1) {
            l = resp[i].split('\t');
            $q = $('<div />').text(l[0]);
            // free response
            if (l.length === 2) {
                $s = $(l[1]);
                if ($s.is('textarea')) {
                    $q.append($s);
                } else {
                    $q.prepend($s);
                }
            // specific options
            } else if (l.length > 2) {
                $s = $('<select />')
                    .append('<option value="" />')
                    .appendTo($q);
                for (j = 1; j < l.length; j += 1) {
                    $s.append($('<option />').attr('value', l[j]).text(l[j]));
                }
            }
            $s.on('blur', submit);
            $demographicsQuestions.append($q);
        }
    });
}());
