import type {
  NodeType,
  EdgeType,
  AnchorType,
  StoreType,
  UserNodeType,
  UserEdgeType,
} from '$lib/models/types';
import { Edge, Anchor, Node } from '$lib/models/store';
import { writable, derived, get, readable } from 'svelte/store';
import { getNodes, getAnchors } from './storeApi';

function createAnchor(
  store: StoreType,
  nodeId: string,
  sourceOrTarget: 'source' | 'target',
  canvasId: string,
  edgeUserLabel: string
) {
  const anchorId = (Math.random() + 1).toString(36).substring(7);

  // This is a callback. It runs later
  // When it runs, it will set the position of the anchor depending
  // on the position of the node
  // TODO: abstract this out so that people can define their own custom anchor positions
  const anchor_cb = () => {
    // get node data
    const node = getNodes(store, { id: nodeId })[0];
    const { positionX, positionY, width, height } = node;
    // calculate the position of the anchor and set
    const anchorsStore = get(store.anchorsStore);
    anchorsStore[anchorId].positionX = positionX + width / 2;
    anchorsStore[anchorId].positionY = positionY;
  };

  // Create a new anchor
  const anchor = new Anchor(
    anchorId,
    nodeId,
    edgeUserLabel,
    sourceOrTarget,
    -1,
    -1,
    anchor_cb,
    canvasId
  );
  // return
  return anchor;
}

export function populateEdgesStore(
  store: StoreType,
  edges: UserEdgeType[],
  canvasId: string
) {
  const edgesStore: { [key: string]: EdgeType } = {};
  for (let i = 0; i < edges.length; i++) {
    const userEdge = edges[i];
    //  { id: 'e1-2', source: 1, type: 'straight', target: 2, label: 'e1-2' },
    // source is node.userLabel for the source node
    // target is node.userLabel for the target node
    // We need to get the anchors
    const {
      source: sourceNodeUserLabel,
      target: targetNodeUserLabel,
      id: edgeUserLabel,
      type,
      label,
      labelBgColor,
      labelTextColor,
      edgeColor,
      animate,
      noHandle,
      arrow,
    } = userEdge;

    const anchors = getAnchors(store, { edgeUserLabel: edgeUserLabel });
    // check that we have two anchors for every edge
    if (anchors.length !== 2) throw 'We should have two anchors for every node';
    // check that we have 1 source anchor and 1 target anchor. Since sourceOrTarget is typed to be either 'source'
    //   or 'target', it suffices to check whether there are two unique elements
    if (new Set(anchors.map((e) => e.sourceOrTarget)).size !== 2)
      throw 'we should have one source and one target anchor';
    // get source and target anchor
    let sourceAnchor, targetAnchor;
    if (anchors[0].sourceOrTarget === 'source') {
      sourceAnchor = anchors[0];
      targetAnchor = anchors[1];
    } else {
      sourceAnchor = anchors[1];
      targetAnchor = anchors[0];
    }

    // create edge
    const edgeId = (Math.random() + 1).toString(36).substring(7);
    const params = {
      id: edgeId,
      sourceId: sourceNodeUserLabel.toString(),
      targetId: targetNodeUserLabel.toString(),
      type,
      sourceX: sourceAnchor.positionX,
      sourceY: sourceAnchor.positionY,
      targetX: targetAnchor.positionX,
      targetY: targetAnchor.positionY,
      sourceAnchorId: sourceAnchor.id,
      targetAnchorId: targetAnchor.id,
      canvasId,
      userLabel: edgeUserLabel,
      label,
      labelBgColor,
      labelTextColor,
      edgeColor,
      animate,
      noHandle,
      arrow,
    };

    edgesStore[edgeId] = new Edge(params);
  }
  store.edgesStore.set(edgesStore);
}

export function populateAnchorsStore(
  store: StoreType,
  edges: UserEdgeType[],
  canvasId: string
) {
  // anchorsStore will populated and synchronized to store.anchorsStore
  const anchorsStore: { [key: string]: AnchorType } = {};
  for (let i = 0; i < edges.length; i++) {
    const userEdge = edges[i];
    // source, target are userLabels, not ids. We need to use source and target to look up the appropriate node in nodesStore and find the node_id
    const { source: sourceNodeId, target: targetNodeId, type } = userEdge;
    // create source anchor
    const sourceAnchor = createAnchor(
      store,
      sourceNodeId.toString(),
      'source',
      canvasId,
      userEdge.id
    );
    // create target anchor
    const targetAnchor = createAnchor(
      store,
      targetNodeId.toString(),
      'target',
      canvasId,
      userEdge.id
    );
    // store source and target anchors
    anchorsStore[sourceAnchor.id] = sourceAnchor;
    anchorsStore[targetAnchor.id] = targetAnchor;
  }

  //populates the anchorsStore
  store.anchorsStore.set(anchorsStore);
  //invoke callback to set each anchor's position based on the nodes
  // TODO: can we refactor this out and set x,y directly in function createAnchor?
  Object.values(get(store.anchorsStore)).forEach((el) => {
    el.callback();
  });
}

export function populateNodesStore(
  store: StoreType,
  nodes: UserNodeType[],
  canvasId: string
) {
  // this is the nodesStore object
  const nodesStore: { [key: string]: NodeType } = {};
  // this is a map between userLabel : nodeId
  const mapLabelToId: { [key: string]: string } = {};
  // iterate through user nodes and create node objects
  for (let i = 0; i < nodes.length; i++) {
    const userNode: UserNodeType = nodes[i];
    const nodeId = userNode.id;

    // TODO: refactor to object destructuring
    const params = {
      id: nodeId.toString(), // the user might input a number
      positionX: userNode.position.x,
      positionY: userNode.position.y,
      width: userNode.width,
      height: userNode.height,
      bgColor: userNode.bgColor,
      data: JSON.stringify(userNode.data),
      canvasId,
      borderColor: userNode.borderColor,
      image: userNode.image,
      src: userNode.src,
      textColor: userNode.textColor,
      targetPosition: userNode.targetPosition,
      sourcePosition: userNode.sourcePosition,
      borderRadius: userNode.borderRadius,
    };

    const node = new Node(params);
    nodesStore[nodeId] = node;
  }
  store.nodesStore.set(nodesStore);
}
