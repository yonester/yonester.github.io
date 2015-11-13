var margins = { top: 20, right: 0, bottom: 80, left: 0 },
    width = 760 - margins.left - margins.right,
    height = 300 - margins.top - margins.bottom;

var layerData,
    focused;

var stack = d3.layout.stack()
    .offset('silhouette')
    .values(function(d) { return d.values; });

var xScale = d3.time.scale()
    .range([0, width]);

var yScale = d3.scale.linear()
    .range([height, 0]);

var color = d3.scale.ordinal()
    .range(['#47686f', '#2ea4a8', '#ffb14a', '#f1643a', '#c42e55']);

var xAxis = d3.svg.axis()
    .orient('bottom')
    .tickSize(-height-margins.top-margins.bottom)
    .ticks(7)
    .tickFormat(d3.time.format('%m.%d %a'))
    .scale(xScale);

var area = d3.svg.area()
    .x(function(d) { return xScale(d.x); })
    .y0(function(d) { return yScale(d.y0); })
    .y1(function(d) { return yScale(d.y0 + d.y); })
    .interpolate('basis');

var ticksClipPath = d3.svg.area()
    .x(function(d) { return xScale(d.x); })
    .y0(height + margins.top + margins.bottom)
    .y1(function(d) { return yScale(d.y0); })
    .interpolate('basis');

var svg = d3.select('#vis').append('svg')
    .attr('width', width + margins.left + margins.right)
    .attr('height', height + margins.top + margins.bottom)
  .append('g')
    .attr('transform', 'translate(' + [margins.left, margins.top] + ')')
    .attr('clip-path', 'url(#svgClipPath)');

var defs = svg.append('defs');

defs.append('clipPath')
    .attr('id', 'svgClipPath')
  .append('rect')
    .attr('width', width - 120)
    .attr('height', height + margins.top + margins.bottom)
    .attr('x', 80)
    .attr('y', 0);

var axisClipPath = defs.append('clipPath')
    .attr('id', 'axisClipPath')
  .append('path');

var gxAxis = svg.append('g')
    .attr('class', 'g-axis')
    .attr('clip-path', 'url(#axisClipPath)')
  .append('g')
    .attr('transform', 'translate(0,' + (height + margins.top + margins.bottom) + ')');

var gLayers = svg.append('g')
    .attr('class', 'g-layers');

var gLabels = svg.append('g')
    .attr('class', 'g-labels');

function draw(data) {
  // Calculate the stack layout, mutatively.
  stack(data);

  // Adjust the scales to fit the data.
  xScale.domain(d3.extent(data[0].values, function(d) { return d.x; }));
  yScale.domain([0, d3.max(data, function(layer) { return d3.max(layer.values, function(d) { return d.y0 + d.y; }); })]);

  // Draw the x-axis.
  gxAxis.call(xAxis).selectAll('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dx', '1.7em')
      .attr('dy', '1.5em')
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'start');

  // Create the shape of the path to transition the layers on enter/exit.
  var ioPath = area(data[0].values.map(function(v) {
    return { x: v.x, y0: 0, y: 0 };
  }));

  // Draw the layers.
  var layers = gLayers.selectAll('.layer')
      .data(data, function(d) { return d.name; });

  layers.enter().append('path')
      .attr('class', 'layer')
      .style('fill', function(d) { return color(d.name); })
      .attr('d', ioPath)
      .on('click', toggleFocus);

  layers.transition()
      .duration(1000)
      .attr('d', function(d) { return area(d.values); });

  layers.exit().transition()
      .duration(1000)
      .attr('d', ioPath);

  // Transition the clipping path of the axis to fit the new shape of the chart.
  axisClipPath.transition()
      .duration(1000)
      .attr('d', ticksClipPath(data[0].values));

  // Draw the text.
  var labels = gLabels.selectAll('g.label')
      .data(data, function(d) { return d.name; });

  var labelsEnter = labels.enter().append('g')
      .attr('class', 'label')
      .style('opacity', 0);

  labelsEnter.append('text')
      .text(function(d) { return d.name; })
      .each(function(d) { d.x0 = width - 60 - this.getBBox().width; });

  labelsEnter
      .attr('transform', function(d) { return 'translate(' + pos.call(this, d) + ')'; })
    .transition()
      .delay(600)
      .style('opacity', 1);

  // Attach/detach the meta data.
  labels.call((data.length === 1) ? attachMeta : detachMeta);

  labels.transition()
      .duration(1000)
      .attr('transform', function(d) {
        return 'translate(' + pos.call(this, d, (data.length === 1)) + ')';
      })
      .style('opacity', function(d) {
        // Don't show labels for super thin layers.
        var last = d.values[d.values.length - 2];
        return yScale(last.y) > 190 ? 0 : 1;
      })
      .style('fill', data.length > 1 ? 'white' : '#333')
      .style('font-size', data.length > 1 ? '13px' : '30px');

  labels.exit().transition()
      .style('opacity', 0)
      .remove();
}

function drawTotal() {
  var totals = layerData.reduce(function(a, b) {
    return [a[0] + b.values[0].y, a[1] + b.values[b.values.length-1].y];
  }, [0,0]);

  d3.select('.panel-counter-value')
      .datum({ from: 0, to: Math.floor(totals[1] / totals[0] * 100) })
      .call(count);
}

function pos(d, single) {
  var last = d.values[d.values.length - 2];
  return single ?
    [width - (d.name.length > 7 ? 220 : 160), 60] :
    [d.x0, yScale(last.y0 + last.y/2) + 6];
}

function attachMeta(g) {
  var values = this.datum().values,
      change = values[values.length-1].y - values[0].y;

  var text = g.append('text')
      .attr('class', 'label-meta')
      .attr('y', 40)
      .attr('x', 15)
      .style('opacity', 0);

  g.append('text')
      .attr('class', 'label-updown')
      .attr('y', change > 0 ? 60 : 0)
      .style('opacity', 0)
      .text(change > 0 ? '▲ ' : '▼ ')
    .transition()
      .delay(900)
      .attr('y', 40)
      .style('opacity', 1);

  text.append('tspan')
      .attr('class', 'label-value')
      .each(function(d) { d.from = 0; d.to = change; })
      .call(count);

  text.append('tspan')
      .attr('class', 'label-units')
      .text(this.datum().units || 'kWh');

  text.transition()
      .duration(1000)
      .style('opacity', 1);
}

function detachMeta(g) {
  var meta = g.select('.label-meta'), up;
  if (!meta.size()) return;

  meta.transition()
      .style('opacity', 0)
      .remove();

  meta.select('.label-value')
      .each(function(d) { up = (d.from < d.to); d.from = d.to; d.to = 0; })
      .call(count);

  g.select('.label-updown').transition()
      .attr('y', up ? 0 : 60)
      .style('opacity', 0)
      .remove();
}

function toggleFocus(d) {
  focused = focused ? null : d.name;
  if (focused) {
    this.parentNode.appendChild(this);
    stack.offset('zero');
    draw([d]);
  } else {
    stack.offset('silhouette');
    draw(layerData);
  }
}

function count(sel) {
  var data = sel.datum(),
      step = Math.floor((data.to - data.from) / 100),
      comp = (step > 0) ? Math.min : Math.max,
      value = data.from,
      t;
  t = setInterval(function() {
    value = comp(value+step, data.to);
    sel.text(value);
    if (value === data.to) { clearInterval(t); }
  }, 10);
}

// Fetch booboo, fetch!
d3.json('data.json', function(data) {
  layerData = data;
  layerData.forEach(function(d) {
    d.values.forEach(function(v) { v.x = new Date(v.x); });
  });

  drawTotal();
  draw(layerData);
});